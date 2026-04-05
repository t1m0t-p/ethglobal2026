import type { BountyMessage, VerdictMessage, BidAcceptMessage, TopicIds } from "../types/index.js";
import { WorkerState } from "../types/index.js";
import { MockHCSService } from "../services/hcs.js";
import { createMockPaymentSigner } from "../services/x402-client.js";
import { startServer } from "../x402-mock-server/server.js";
import { WorkerAgent } from "./worker.js";

// ──────────────────────────────────────────────
// Worker Mock — Full E2E test with no external deps
// ──────────────────────────────────────────────

const MOCK_TOPIC_IDS: TopicIds = {
  bounties: "0.0.MOCK_BOUNTIES",
  bids: "0.0.MOCK_BIDS",
  results: "0.0.MOCK_RESULTS",
  verdicts: "0.0.MOCK_VERDICTS",
};

const MOCK_BOUNTY: BountyMessage = {
  type: "bounty",
  taskId: "btc-price-fetch-001",
  description: "Fetch BTC price from 3 sources, return average",
  reward: 100,
  deadline: new Date(Date.now() + 60_000).toISOString(), // 1 min from now
  requesterAddress: "0.0.12345",
};

const WORKER_ID = "0.0.MOCK_WORKER_1";

async function runMockTest(): Promise<void> {
  console.log("═══════════════════════════════════════════");
  console.log("  Hivera — Worker Mock Test");
  console.log("═══════════════════════════════════════════\n");

  // Step 1: Start x402 mock server
  console.log("▶ Starting x402 mock server...");
  const server = await startServer(4021); // Use different port to avoid conflicts

  // Step 2: Create mock HCS service
  const mockHCS = new MockHCSService();

  // Step 3: Create worker agent
  const worker = new WorkerAgent({
    workerId: WORKER_ID,
    hcsService: mockHCS,
    paymentSigner: createMockPaymentSigner(WORKER_ID),
    x402Url: "http://localhost:4021/api/v1/btc-price",
    topicIds: MOCK_TOPIC_IDS,
    bidAmount: 50,
  });

  // Step 4: Start worker (enters DISCOVERING state)
  console.log("\n▶ Starting worker agent...");
  await worker.start();
  assertState(worker, WorkerState.DISCOVERING);

  // Step 5: Simulate a bounty arriving via HCS
  console.log("\n▶ Simulating bounty arrival...");
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.bounties, MOCK_BOUNTY);

  // Step 5a: Wait for the worker to bid and enter AWAITING_ACCEPTANCE,
  // then simulate the Requester's bid-accept so execution can proceed.
  await waitForState(worker, WorkerState.AWAITING_ACCEPTANCE, 5_000);

  console.log("\n▶ Simulating Requester bid-accept...");
  const bidAccept: BidAcceptMessage = {
    type: "bid-accept",
    taskId: MOCK_BOUNTY.taskId,
    workerId: WORKER_ID,
    acceptedAmount: 50,
  };
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.bids, bidAccept);

  // Wait for async processing to complete
  await waitForState(worker, WorkerState.COMPLETED, 15_000);

  // Step 6: Verify published messages
  console.log("\n▶ Verifying published messages...");
  const published = mockHCS.getPublished();

  const bids = published.filter((m) => m.message.type === "bid");
  const results = published.filter((m) => m.message.type === "result");

  assert(bids.length === 1, `Expected 1 bid, got ${bids.length}`);
  assert(results.length === 1, `Expected 1 result, got ${results.length}`);

  const bid = bids[0].message;
  assert(bid.type === "bid" && bid.workerId === WORKER_ID, "Bid has correct workerId");
  assert(bid.type === "bid" && bid.taskId === MOCK_BOUNTY.taskId, "Bid has correct taskId");

  const result = results[0].message;
  assert(result.type === "result" && result.data.sources.length >= 2, "Result has 2+ price sources");
  assert(result.type === "result" && result.data.average > 0, "Result has positive average price");

  console.log(`\n  Bid: ${bid.type === "bid" ? bid.bidAmount : "?"} HBAR for ${bid.type === "bid" ? bid.taskId : "?"}`);
  console.log(`  Result: $${result.type === "result" ? result.data.average : "?"} avg from ${result.type === "result" ? result.data.sources.join(", ") : "?"}`);

  // Step 7: Simulate a verdict
  console.log("\n▶ Simulating verdict...");
  const verdict: VerdictMessage = {
    type: "verdict",
    taskId: MOCK_BOUNTY.taskId,
    winnerId: WORKER_ID,
    reason: "Most accurate price average",
    paymentAmount: 100,
  };
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.verdicts, verdict);

  // Cleanup
  worker.stop();
  server.close();

  console.log("\n═══════════════════════════════════════════");
  console.log("  ✓ All checks passed!");
  console.log("═══════════════════════════════════════════\n");
}

// ── Helpers ──

function assertState(worker: WorkerAgent, expected: WorkerState): void {
  const actual = worker.getState();
  if (actual !== expected) {
    throw new Error(`State assertion failed: expected ${expected}, got ${actual}`);
  }
  console.log(`  ✓ Worker state: ${actual}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function waitForState(
  worker: WorkerAgent,
  target: WorkerState,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  while (worker.getState() !== target) {
    if (worker.getState() === WorkerState.ERROR) {
      throw new Error(`Worker entered ERROR state: ${worker.getErrorReason()}`);
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timeout waiting for state ${target} — stuck in ${worker.getState()}`,
      );
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log(`  ✓ Worker reached state: ${target}`);
}

// ── Run ──

runMockTest().catch((err) => {
  console.error("\n✗ Mock test failed:", err);
  process.exit(1);
});
