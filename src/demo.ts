/**
 * demo.ts — Hivera Full Demo Orchestrator
 *
 * Runs the complete multi-agent flow against real Hedera testnet:
 *   Requester → posts bounty (HCS)
 *   Worker    → discovers, bids, fetches BTC price via x402, posts result (HCS)
 *   Judge     → evaluates submissions, posts verdict (HCS), releases HIVE payment (HTS)
 *
 * Prerequisites:
 *   1. .env configured with HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, all topic IDs, HTS_TOKEN_ID
 *   2. Run `npm run setup` first if topic IDs and token ID are not yet in .env
 *
 * Usage:
 *   npm run demo
 */

import { startServer } from "./x402-mock-server/server.js";
import { WorkerAgent } from "./agents/worker.js";
import { RequesterAgent } from "./agents/requester.js";
import { JudgeAgent } from "./agents/judge.js";
import { HCSService } from "./services/hcs.js";
import { createJudgeProvider } from "./services/llm-judge.js";
import { createMockPaymentSigner } from "./services/x402-client.js";
import { createHederaClient, loadTopicIds, loadJudgeConfig } from "./config/hedera.js";

const X402_PORT = parseInt(process.env.X402_SERVER_PORT || "4020", 10);
const X402_URL = `http://localhost:${X402_PORT}/api/v1/btc-price`;

// ──────────────────────────────────────────────
// Demo entrypoint
// ──────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   Hivera — Multi-Agent Demo on Hedera Testnet  ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ── Setup ──────────────────────────────────────────────────────────────────

  console.log("▶ Starting x402 mock server...");
  const x402Server = await startServer(X402_PORT);
  console.log(`  x402 server running on port ${X402_PORT}\n`);

  const client = createHederaClient();
  const topicIds = loadTopicIds();
  const judgeConfig = loadJudgeConfig();

  const accountId = process.env.HEDERA_ACCOUNT_ID!;

  // All agents share one HCSService backed by the same Hedera client.
  // In a real multi-machine deployment each agent would have its own client.
  const hcsService = new HCSService(client);

  const judgeProvider = createJudgeProvider();

  // ── Instantiate agents ─────────────────────────────────────────────────────

  const requester = new RequesterAgent({
    requesterId: accountId,
    hcsService,
    topicIds,
    maxAcceptedBids: 2,
  });

  const worker = new WorkerAgent({
    workerId: accountId,
    hcsService,
    paymentSigner: createMockPaymentSigner(accountId),
    x402Url: X402_URL,
    topicIds,
    bidAmount: 50,
  });

  const judge = new JudgeAgent({
    judgeId: accountId,
    hcsService,
    topicIds,
    judgeProvider,
    hederaClient: client,
    tokenId: judgeConfig.tokenId,
    payerAccountId: judgeConfig.payerAccountId,
    payerPrivateKey: judgeConfig.payerPrivateKey,
    resultWaitMs: 30_000,
    minResultsToEvaluate: 1, // evaluate as soon as 1 result arrives (single worker demo)
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────

  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    worker.stop();
    judge.stop();
    x402Server.close();
    process.exit(0);
  });

  // ── Start all agents ───────────────────────────────────────────────────────

  console.log("▶ Starting agents...");
  await requester.start();
  await worker.start();
  await judge.start();
  console.log("  All agents running\n");

  // ── Define the task ────────────────────────────────────────────────────────

  const taskId = `btc-price-${Date.now()}`;
  const deadline = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

  const task = {
    taskId,
    description: "Fetch BTC/USD price from 3 independent sources and return the average",
    reward: 100,
    deadline,
  };

  // Tell the Judge which task to watch before the Requester posts it
  judge.watchTask({
    type: "bounty",
    requesterAddress: accountId,
    ...task,
  });

  // Small delay to ensure all subscriptions are established
  await sleep(2000);

  // ── Post bounty ────────────────────────────────────────────────────────────

  console.log("▶ Requester posting bounty...");
  await requester.postBounty(task);

  console.log("\n▶ Waiting for Worker to discover, execute, and submit result...");
  console.log(`  (Judge will evaluate after 30s or 1 result — whichever comes first)\n`);

  // Wait long enough for the full flow to complete:
  // ~2s HCS propagation + ~5s price fetch + ~2s HCS publish + 30s judge wait + ~2s payment
  await sleep(60_000);

  // ── Finish ─────────────────────────────────────────────────────────────────

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   Demo complete                               ║");
  console.log("║   Verify all transactions on Hashscan:        ║");
  console.log(`║   https://hashscan.io/testnet/account/${accountId.padEnd(10)} ║`);
  console.log("╚══════════════════════════════════════════════╝\n");

  worker.stop();
  judge.stop();
  x402Server.close();
  client.close();
  process.exit(0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
