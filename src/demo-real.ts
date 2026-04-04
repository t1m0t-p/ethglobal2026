/**
 * demo-real.ts — Hivera Full Demo Without Mocks
 *
 * Runs the complete multi-agent flow against real Hedera testnet with real payment signing:
 *   Requester → posts bounty (HCS)
 *   Worker    → discovers, bids, signs real HBAR transfers for x402 payments, posts result (HCS)
 *   Judge     → evaluates submissions with real Gemini API, posts verdict (HCS), releases payment
 *
 * Prerequisites:
 *   1. .env configured with HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, all topic IDs
 *   2. ANTHROPIC_API_KEY for Judge's decision-making
 *   3. GEMINI_API_KEY or WORKER2_GEMINI_API_KEY in .env for real Worker 2
 *   4. Run `npm run setup` first if topic IDs are not yet in .env
 *
 * Key differences from npm run demo:
 *   - Uses createRealPaymentSigner (actual Hedera transfers, not mock signatures)
 *   - Uses real Gemini API if available in .env (no mock fallback)
 *   - x402 mock server still used (simulates the server endpoint; payment signing is what's real)
 *
 * Usage:
 *   npm run demo:real
 */

import { startServer } from "./x402-mock-server/server.js";
import { WorkerAgent } from "./agents/worker.js";
import { RequesterAgent } from "./agents/requester.js";
import { JudgeAgent } from "./agents/judge.js";
import { HCSService } from "./services/hcs.js";
import { EscrowService } from "./services/escrow.js";
import { LLMService } from "./services/llm.js";
import { createRealPaymentSigner } from "./services/x402-client.js";
import { createHederaClient, loadTopicIds, loadJudgeConfig, loadEscrowConfig, loadWorker2Config } from "./config/hedera.js";
import { createGeminiWorkerService } from "./services/gemini-worker.js";
import { PrivateKey } from "@hiero-ledger/sdk";

const X402_PORT = parseInt(process.env.X402_SERVER_PORT || "4020", 10);
const X402_URL = `http://localhost:${X402_PORT}/api/v1/btc-price`;

// ──────────────────────────────────────────────
// Demo entrypoint (real, no mocks)
// ──────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   Hivera — Multi-Agent Demo on Hedera Testnet (REAL, NO MOCKS) ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // ── Setup ──────────────────────────────────────────────────────────────────

  console.log("▶ Starting x402 mock server...");
  const x402Server = await startServer(X402_PORT);
  console.log(`  x402 mock server running on port ${X402_PORT}\n`);

  const client = createHederaClient();
  const topicIds = loadTopicIds();
  const judgeConfig = loadJudgeConfig();
  const escrowConfig = loadEscrowConfig();

  const accountId = process.env.HEDERA_ACCOUNT_ID!;

  // All agents share one HCSService backed by the same Hedera client.
  const hcsService = new HCSService(client);

  // Initialize escrow account (holds HBAR during task execution)
  const requesterEscrow = new EscrowService(
    client,
    escrowConfig.escrowAccountId,
    PrivateKey.fromStringDer(escrowConfig.escrowPrivateKey),
  );
  const judgeEscrow = new EscrowService(
    client,
    escrowConfig.escrowAccountId,
    PrivateKey.fromStringDer(escrowConfig.escrowPrivateKey),
  );

  // Initialize LLM service for Judge
  const llmService = new LLMService(judgeConfig.anthropicApiKey);

  // ── Instantiate agents ─────────────────────────────────────────────────────

  // Create Judge first so we can wire the callback
  const judge = new JudgeAgent({
    accountId: judgeConfig.accountId,
    hcsService,
    topicIds,
    llmService,
    escrowService: judgeEscrow,
    resultsWaitMs: 30_000,
  });

  const requester = new RequesterAgent({
    accountId,
    privateKey: PrivateKey.fromStringDer(process.env.REQUESTER_PRIVATE_KEY ?? process.env.HEDERA_PRIVATE_KEY!),
    hcsService,
    topicIds,
    escrowService: requesterEscrow,
    maxBidsToAccept: 2,
    onEscrowCreated: (escrowInfo) => {
      // Wire escrow info to Judge after Requester locks it
      judge.setEscrowInfo(escrowInfo.taskId, escrowInfo);
    },
  });

  // Worker 1: Real payment signer (actual HBAR transfers)
  const workerPrivateKey = PrivateKey.fromStringDer(process.env.HEDERA_PRIVATE_KEY!);
  const realPaymentSigner = createRealPaymentSigner(client, accountId, workerPrivateKey);
  const worker = new WorkerAgent({
    workerId: accountId,
    hcsService,
    paymentSigner: realPaymentSigner,
    x402Url: X402_URL,
    topicIds,
    bidAmount: 50,
  });

  // Worker 2: Real Gemini service + real payment signing
  const worker2Config = loadWorker2Config();
  const worker2PrivateKey = PrivateKey.fromStringDer(worker2Config.privateKey);
  const worker2PaymentSigner = createRealPaymentSigner(client, worker2Config.accountId, worker2PrivateKey);
  const worker2GeminiService = createGeminiWorkerService(X402_URL, worker2PaymentSigner, {
    geminiApiKey: worker2Config.geminiApiKey, // Required, no fallback to mock
    hederaAccountId: worker2Config.accountId,
    hederaPrivateKey: worker2Config.privateKey,
  });

  const worker2 = new WorkerAgent({
    workerId: worker2Config.accountId,
    hcsService,
    paymentSigner: worker2PaymentSigner,
    x402Url: X402_URL,
    topicIds,
    bidAmount: 50,
    geminiWorker: worker2GeminiService,
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────

  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    worker.stop();
    worker2.stop();
    judge.stop();
    x402Server.close();
    process.exit(0);
  });

  // ── Start Judge and Worker agents first to ensure subscriptions ─────────────

  console.log("▶ Starting Judge and Worker agents...");
  await judge.start();
  await worker.start();
  await worker2.start();
  console.log("  Agents subscribed to HCS topics\n");

  // Small delay to ensure all subscriptions are established
  await sleep(2000);

  // ── Define the task ────────────────────────────────────────────────────────

  const taskId = `btc-price-${Date.now()}`;
  const deadline = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

  const bountyParams = {
    taskId,
    description: "Fetch BTC/USD price from 3 independent sources and return the average",
    reward: 100,
    deadline,
    strategy: "quality" as const,
    category: "crypto-price" as const,
  };

  // ── Requester posts bounty ────────────────────────────────────────────────────

  console.log("▶ Requester posting bounty...");
  await requester.start(bountyParams);

  console.log("\n▶ Waiting for Worker to discover, execute, and submit result...");
  console.log(`  (Judge will evaluate after 30s or 1 result — whichever comes first)\n`);

  // Wait long enough for the full flow to complete:
  // ~2s HCS propagation + ~5s price fetch + ~2s HCS publish + 30s judge wait + ~2s payment
  await sleep(60_000);

  // ── Finish ─────────────────────────────────────────────────────────────────

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║   Demo complete (REAL, NO MOCKS)                            ║");
  console.log("║   Verify all transactions on Hashscan:                      ║");
  console.log(`║   https://hashscan.io/testnet/account/${accountId.padEnd(10)} ║`);
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  worker.stop();
  worker2.stop();
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
