import type { BountyMessage, BidMessage, VerdictMessage, TopicIds } from "../types/index.js";
import { RequesterState } from "../types/index.js";
import { MockHCSService } from "../services/hcs.js";
import { MockEscrowService } from "../services/escrow.js";
import { RequesterAgent } from "./requester.js";
import { PrivateKey } from "@hiero-ledger/sdk";

// ──────────────────────────────────────────────
// Requester Mock — Full E2E test with no external deps
// ──────────────────────────────────────────────

const MOCK_TOPIC_IDS: TopicIds = {
  bounties: "0.0.MOCK_BOUNTIES",
  bids: "0.0.MOCK_BIDS",
  results: "0.0.MOCK_RESULTS",
  verdicts: "0.0.MOCK_VERDICTS",
};

const REQUESTER_ID = "0.0.MOCK_REQUESTER";

const MOCK_BOUNTY_PARAMS: Omit<BountyMessage, "type" | "requesterAddress"> = {
  taskId: "btc-price-fetch-001",
  description: "Fetch BTC price from 3 sources, return average",
  reward: 100,
  deadline: new Date(Date.now() + 60_000).toISOString(), // 1 minute from now
  strategy: "quality",
  category: "crypto-price",
};

const MOCK_BID_1: BidMessage = {
  type: "bid",
  taskId: "btc-price-fetch-001",
  workerId: "0.0.MOCK_WORKER_1",
  bidAmount: 50,
  estimatedTime: "30s",
};

const MOCK_BID_2: BidMessage = {
  type: "bid",
  taskId: "btc-price-fetch-001",
  workerId: "0.0.MOCK_WORKER_2",
  bidAmount: 45,
  estimatedTime: "25s",
};

async function runMockTest(): Promise<void> {
  console.log("═══════════════════════════════════════════");
  console.log("  AgentBazaar — Requester Mock Test");
  console.log("═══════════════════════════════════════════\n");

  // Step 1: Create mock services (no Hedera, no external deps)
  console.log("▶ Creating mock services...");
  const mockHCS = new MockHCSService();
  const mockEscrow = new MockEscrowService();

  // Step 2: Create requester agent with injected mocks
  const mockPrivateKey = PrivateKey.generate();

  const requester = new RequesterAgent({
    accountId: REQUESTER_ID,
    privateKey: mockPrivateKey,
    hcsService: mockHCS,
    topicIds: MOCK_TOPIC_IDS,
    escrowService: mockEscrow,
    maxBidsToAccept: 2,
  });

  // Step 3: Start requester — posts bounty, enters AWAITING_BIDS
  console.log("\n▶ Starting requester agent...");
  await requester.start(MOCK_BOUNTY_PARAMS);
  assertState(requester, RequesterState.AWAITING_BIDS);

  // Verify the bounty was published to HCS
  const publishedAfterStart = mockHCS.getPublished();
  const bounties = publishedAfterStart.filter((m) => m.message.type === "bounty");
  assert(bounties.length === 1, "Published exactly 1 bounty to HCS");

  const bounty = bounties[0].message;
  assert(
    bounty.type === "bounty" && bounty.taskId === MOCK_BOUNTY_PARAMS.taskId,
    "Bounty has correct taskId",
  );
  assert(
    bounty.type === "bounty" && bounty.reward === MOCK_BOUNTY_PARAMS.reward,
    "Bounty has correct reward",
  );
  assert(
    bounty.type === "bounty" && bounty.requesterAddress === REQUESTER_ID,
    "Bounty has correct requesterAddress",
  );
  assert(
    bounty.type === "bounty" && bounty.strategy === "quality",
    "Bounty has correct strategy",
  );
  assert(
    bounty.type === "bounty" && bounty.category === "crypto-price",
    "Bounty has correct category",
  );

  // Step 4: Simulate 2 bids arriving via HCS
  console.log("\n▶ Simulating 2 worker bids...");
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.bids, MOCK_BID_1);
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.bids, MOCK_BID_2);

  // Step 5: Wait for escrow to be created → state = AWAITING_RESULTS
  await waitForState(requester, RequesterState.AWAITING_RESULTS, 5_000);

  // Step 6: Verify bid acceptance and escrow
  console.log("\n▶ Verifying bid acceptance and escrow...");
  const acceptedBids = requester.getAcceptedBids();
  assert(acceptedBids.length === 2, `Accepted exactly 2 bids (got ${acceptedBids.length})`);
  assert(
    acceptedBids[0].workerId === MOCK_BID_1.workerId,
    "First accepted bid is from Worker 1",
  );
  assert(
    acceptedBids[1].workerId === MOCK_BID_2.workerId,
    "Second accepted bid is from Worker 2",
  );

  const escrowInfo = requester.getEscrowInfo();
  assert(escrowInfo !== null, "Escrow was created");
  assert(
    escrowInfo!.taskId === MOCK_BOUNTY_PARAMS.taskId,
    "Escrow has correct taskId",
  );
  assert(escrowInfo!.amount === MOCK_BOUNTY_PARAMS.reward, "Escrow amount matches reward");
  assert(mockEscrow.isReleased(escrowInfo!.taskId) === false, "Escrow not yet released");

  console.log(`\n  Escrow: ${escrowInfo!.escrowAccountId} — ${escrowInfo!.amount} HBAR locked`);

  // Step 7: Simulate a third bid — should be ignored (already at max)
  console.log("\n▶ Simulating excess bid (should be ignored)...");
  const extraBid: BidMessage = {
    type: "bid",
    taskId: "btc-price-fetch-001",
    workerId: "0.0.MOCK_WORKER_3",
    bidAmount: 60,
    estimatedTime: "45s",
  };
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.bids, extraBid);
  // Give a tick for the handler to run
  await new Promise((r) => setTimeout(r, 50));
  assert(requester.getAcceptedBids().length === 2, "Excess bid was ignored (still 2 bids)");

  // Step 8: Simulate verdict arriving → state = COMPLETED
  console.log("\n▶ Simulating verdict...");
  const verdict: VerdictMessage = {
    type: "verdict",
    taskId: MOCK_BOUNTY_PARAMS.taskId,
    winnerId: MOCK_BID_1.workerId,
    reason: "Most accurate price average with lowest variance",
    paymentAmount: 100,
  };
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.verdicts, verdict);
  await waitForState(requester, RequesterState.COMPLETED, 2_000);

  // Cleanup
  requester.stop();

  console.log("\n═══════════════════════════════════════════");
  console.log("  ✓ All checks passed!");
  console.log("═══════════════════════════════════════════\n");
}

// ── Helpers ──

function assertState(requester: RequesterAgent, expected: RequesterState): void {
  const actual = requester.getState();
  if (actual !== expected) {
    throw new Error(`State assertion failed: expected ${expected}, got ${actual}`);
  }
  console.log(`  ✓ Requester state: ${actual}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function waitForState(
  requester: RequesterAgent,
  target: RequesterState,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  while (requester.getState() !== target) {
    if (requester.getState() === RequesterState.ERROR) {
      throw new Error(
        `Requester entered ERROR state: ${requester.getErrorReason()}`,
      );
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timeout waiting for state ${target} — stuck in ${requester.getState()}`,
      );
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log(`  ✓ Requester reached state: ${target}`);
}

// ── Run ──

runMockTest().catch((err) => {
  console.error("\n✗ Requester mock test failed:", err);
  process.exit(1);
});
