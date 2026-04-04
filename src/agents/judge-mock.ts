import type { BountyMessage, BidMessage, ResultMessage, VerdictMessage, TopicIds } from "../types/index.js";
import { JudgeState } from "../types/index.js";
import { MockHCSService } from "../services/hcs.js";
import { MockEscrowService, type EscrowInfo } from "../services/escrow.js";
import { MockLLMService } from "../services/llm.js";
import { JudgeAgent } from "./judge.js";

// ──────────────────────────────────────────────
// Judge Mock — Full E2E test with no external deps
// ──────────────────────────────────────────────

const MOCK_TOPIC_IDS: TopicIds = {
  bounties: "0.0.MOCK_BOUNTIES",
  bids: "0.0.MOCK_BIDS",
  results: "0.0.MOCK_RESULTS",
  verdicts: "0.0.MOCK_VERDICTS",
};

const JUDGE_ID = "0.0.MOCK_JUDGE";

const MOCK_BOUNTY: BountyMessage = {
  type: "bounty",
  taskId: "btc-price-fetch-001",
  description: "Fetch BTC price from 3 sources, return average",
  reward: 100,
  deadline: new Date(Date.now() + 60_000).toISOString(),
  requesterAddress: "0.0.MOCK_REQUESTER",
  strategy: "quality",
  category: "crypto-price",
};

// Worker 1: 3 sources, tight variance — should WIN
const MOCK_RESULT_1: ResultMessage = {
  type: "result",
  taskId: "btc-price-fetch-001",
  workerId: "0.0.MOCK_WORKER_1",
  data: {
    sources: ["coingecko", "kraken", "binance"],
    prices: [84200, 84195, 84205],
    average: 84200,
  },
};

// Worker 2: 2 sources, wider variance — should LOSE
const MOCK_RESULT_2: ResultMessage = {
  type: "result",
  taskId: "btc-price-fetch-001",
  workerId: "0.0.MOCK_WORKER_2",
  data: {
    sources: ["coingecko", "kraken"],
    prices: [84100, 84350],
    average: 84225,
  },
};

const MOCK_ESCROW: EscrowInfo = {
  escrowAccountId: "0.0.MOCK_ESCROW_ACCOUNT",
  taskId: "btc-price-fetch-001",
  amount: 100,
};

const RESULTS_WAIT_MS = 500; // Fast for testing (vs 30s in production)

async function runMockTest(): Promise<void> {
  console.log("═══════════════════════════════════════════");
  console.log("  AgentBazaar — Judge Mock Test");
  console.log("═══════════════════════════════════════════\n");

  // Step 1: Create mock services (no Hedera, no Anthropic API)
  console.log("▶ Creating mock services...");
  const mockHCS = new MockHCSService();
  const mockEscrow = new MockEscrowService();
  const mockLLM = new MockLLMService();

  // Step 2: Create judge agent with fast evaluation window
  const judge = new JudgeAgent({
    accountId: JUDGE_ID,
    hcsService: mockHCS,
    topicIds: MOCK_TOPIC_IDS,
    llmService: mockLLM,
    escrowService: mockEscrow,
    resultsWaitMs: RESULTS_WAIT_MS,
  });

  // Step 3: Start judge — enters MONITORING state
  console.log("\n▶ Starting judge agent...");
  await judge.start();
  assertState(judge, JudgeState.MONITORING);

  // Step 4: Inject escrow info (normally done by orchestrator)
  judge.setEscrowInfo(MOCK_BOUNTY.taskId, MOCK_ESCROW);

  // Step 5: Simulate bounty arriving (gives judge task description for LLM context)
  console.log("\n▶ Simulating bounty arrival...");
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.bounties, MOCK_BOUNTY);

  // Step 6: Simulate 2 results from competing workers
  console.log("\n▶ Simulating 2 worker results...");
  console.log(
    `  Worker 1: 3 sources [${MOCK_RESULT_1.data.prices.join(", ")}] avg $${MOCK_RESULT_1.data.average}`,
  );
  console.log(
    `  Worker 2: 2 sources [${MOCK_RESULT_2.data.prices.join(", ")}] avg $${MOCK_RESULT_2.data.average}`,
  );
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.results, MOCK_RESULT_1);
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.results, MOCK_RESULT_2);

  // Step 7: Wait for evaluation timer to fire (RESULTS_WAIT_MS + buffer)
  console.log(`\n▶ Waiting ${RESULTS_WAIT_MS + 200}ms for evaluation timer...`);
  await new Promise((r) => setTimeout(r, RESULTS_WAIT_MS + 200));

  // Step 8: Wait for full pipeline (evaluate → verdict → release) to complete
  await waitForState(judge, JudgeState.COMPLETED, 5_000);

  // Step 9: Verify verdict was published
  console.log("\n▶ Verifying published verdict...");
  const published = mockHCS.getPublished();
  const verdicts = published.filter((m) => m.message.type === "verdict");

  assert(verdicts.length === 1, `Published exactly 1 verdict (got ${verdicts.length})`);

  const verdict = verdicts[0].message;
  assert(verdict.type === "verdict", "Published message has type 'verdict'");
  assert(
    verdict.type === "verdict" && verdict.taskId === MOCK_BOUNTY.taskId,
    "Verdict has correct taskId",
  );
  assert(
    verdict.type === "verdict" && verdict.winnerId === MOCK_RESULT_1.workerId,
    `Worker 1 won (most sources + lowest variance) — got: ${verdict.type === "verdict" ? verdict.winnerId : "?"}`,
  );
  assert(
    verdict.type === "verdict" && verdict.paymentAmount === MOCK_BOUNTY.reward,
    `Payment amount matches bounty reward (${MOCK_BOUNTY.reward} HBAR)`,
  );
  assert(
    verdict.type === "verdict" && verdict.reason.length > 0,
    "Verdict has a non-empty reason",
  );

  const lastVerdict = judge.getLastVerdict();
  assert(lastVerdict !== null, "Judge stored last verdict");

  // Step 10: Verify escrow was released
  console.log("\n▶ Verifying escrow release...");
  const releaseInfo = mockEscrow.getRelease(MOCK_ESCROW.taskId);
  assert(
    releaseInfo !== undefined && releaseInfo.winnerId === MOCK_RESULT_1.workerId,
    `Escrow released to correct winner (${MOCK_RESULT_1.workerId})`,
  );

  console.log(`\n  Verdict summary:`);
  if (verdict.type === "verdict") {
    console.log(`    Winner:  ${verdict.winnerId}`);
    console.log(`    Payment: ${verdict.paymentAmount} HBAR`);
    console.log(`    Reason:  "${verdict.reason}"`);
  }

  // Cleanup
  judge.stop();

  console.log("\n═══════════════════════════════════════════");
  console.log("  ✓ All checks passed!");
  console.log("═══════════════════════════════════════════\n");
}

// ── Helpers ──

function assertState(judge: JudgeAgent, expected: JudgeState): void {
  const actual = judge.getState();
  if (actual !== expected) {
    throw new Error(`State assertion failed: expected ${expected}, got ${actual}`);
  }
  console.log(`  ✓ Judge state: ${actual}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function waitForState(
  judge: JudgeAgent,
  target: JudgeState,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  while (judge.getState() !== target) {
    if (judge.getState() === JudgeState.ERROR) {
      throw new Error(`Judge entered ERROR state: ${judge.getErrorReason()}`);
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timeout waiting for state ${target} — stuck in ${judge.getState()}`,
      );
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log(`  ✓ Judge reached state: ${target}`);
}

// ──────────────────────────────────────────────
// Price Mode Test — cheapest bidder should win
// ──────────────────────────────────────────────

async function runPriceModeTest(): Promise<void> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  AgentBazaar — Judge Price-Mode Test");
  console.log("═══════════════════════════════════════════\n");

  const mockHCS = new MockHCSService();
  const mockEscrow = new MockEscrowService();
  const mockLLM = new MockLLMService();

  const judge = new JudgeAgent({
    accountId: JUDGE_ID,
    hcsService: mockHCS,
    topicIds: MOCK_TOPIC_IDS,
    llmService: mockLLM,
    escrowService: mockEscrow,
    resultsWaitMs: RESULTS_WAIT_MS,
  });

  await judge.start();

  const priceBounty: BountyMessage = {
    type: "bounty",
    taskId: "price-mode-001",
    description: "Find cheapest delivery rate Paris→Berlin",
    reward: 80,
    deadline: new Date(Date.now() + 60_000).toISOString(),
    requesterAddress: "0.0.MOCK_REQUESTER",
    strategy: "price",
    category: "delivery",
  };

  const escrow: EscrowInfo = {
    escrowAccountId: "0.0.MOCK_ESCROW_ACCOUNT",
    taskId: "price-mode-001",
    amount: 80,
  };

  judge.setEscrowInfo(priceBounty.taskId, escrow);
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.bounties, priceBounty);

  // Simulate bids — Worker 2 is cheaper
  const bid1: BidMessage = { type: "bid", taskId: "price-mode-001", workerId: "0.0.MOCK_WORKER_1", bidAmount: 50, estimatedTime: "30s" };
  const bid2: BidMessage = { type: "bid", taskId: "price-mode-001", workerId: "0.0.MOCK_WORKER_2", bidAmount: 30, estimatedTime: "25s" };
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.bids, bid1);
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.bids, bid2);

  // Worker 1 has better quality (3 sources), Worker 2 has cheaper bid (2 sources)
  const result1: ResultMessage = {
    type: "result", taskId: "price-mode-001", workerId: "0.0.MOCK_WORKER_1",
    data: { sources: ["coingecko", "kraken", "binance"], prices: [84200, 84195, 84205], average: 84200 },
  };
  const result2: ResultMessage = {
    type: "result", taskId: "price-mode-001", workerId: "0.0.MOCK_WORKER_2",
    data: { sources: ["coingecko", "kraken"], prices: [84100, 84350], average: 84225 },
  };

  console.log("▶ Simulating bids + results (Worker 2 has cheaper bid)...");
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.results, result1);
  mockHCS.simulateMessage(MOCK_TOPIC_IDS.results, result2);

  await new Promise((r) => setTimeout(r, RESULTS_WAIT_MS + 200));
  await waitForState(judge, JudgeState.COMPLETED, 5_000);

  const published = mockHCS.getPublished();
  const verdicts = published.filter((m) => m.message.type === "verdict" && m.message.taskId === "price-mode-001");
  assert(verdicts.length === 1, "Published exactly 1 verdict for price-mode task");

  const verdict = verdicts[0].message;
  assert(
    verdict.type === "verdict" && verdict.winnerId === "0.0.MOCK_WORKER_2",
    `In price mode, cheaper bidder (Worker 2) wins — got: ${verdict.type === "verdict" ? verdict.winnerId : "?"}`,
  );

  judge.stop();

  console.log("\n═══════════════════════════════════════════");
  console.log("  ✓ Price-mode test passed!");
  console.log("═══════════════════════════════════════════\n");
}

// ── Run ──

runMockTest()
  .then(() => runPriceModeTest())
  .catch((err) => {
    console.error("\n✗ Judge mock test failed:", err);
    process.exit(1);
  });
