/**
 * worker2.ts — CLI entrypoint for Worker Agent #2
 *
 * Identical to worker.ts but reads WORKER2_* env vars for a distinct Hedera identity.
 * Uses loadWorker2Config() which falls back to WORKER_ACCOUNT_ID → HEDERA_ACCOUNT_ID.
 */

export { WorkerAgent } from "./worker.js";

// ──────────────────────────────────────────────
// CLI entrypoint — run against real Hedera
// ──────────────────────────────────────────────

async function main(): Promise<void> {
  const { createHederaClient, loadTopicIds, loadWorker2Config } = await import(
    "../config/hedera.js"
  );
  const { HCSService } = await import("../services/hcs.js");
  const { createGeminiWorkerService } = await import("../services/gemini-worker.js");
  const { createRealPaymentSigner } = await import("../services/x402-client.js");
  const { WorkerAgent } = await import("./worker.js");
  const { PrivateKey } = await import("@hiero-ledger/sdk");

  const client = createHederaClient();
  const topicIds = loadTopicIds();
  const workerConfig = loadWorker2Config();
  const x402Url = process.env.X402_SERVER_URL || "http://localhost:4020";

  const hcsService = new HCSService(client);
  const paymentSigner = createRealPaymentSigner(
    client,
    workerConfig.accountId,
    PrivateKey.fromStringDer(workerConfig.privateKey),
  );
  const x402FullUrl = `${x402Url}/api/v1/btc-price`;

  // Use WORKER2_GEMINI_API_KEY if set, otherwise fall back to GEMINI_API_KEY
  const originalKey = process.env.GEMINI_API_KEY;
  if (workerConfig.geminiApiKey) {
    process.env.GEMINI_API_KEY = workerConfig.geminiApiKey;
  }

  const geminiWorker = createGeminiWorkerService(x402FullUrl, paymentSigner, {
    hederaAccountId: workerConfig.accountId,
    hederaPrivateKey: workerConfig.privateKey,
  });

  // Restore original key after factory call
  if (workerConfig.geminiApiKey) {
    process.env.GEMINI_API_KEY = originalKey ?? "";
  }

  const worker = new WorkerAgent({
    workerId: workerConfig.accountId,
    hcsService,
    paymentSigner,
    x402Url: x402FullUrl,
    topicIds,
    geminiWorker,
  });

  process.on("SIGINT", () => {
    console.log("\nShutting down worker2...");
    worker.stop();
    process.exit(0);
  });

  await worker.start();
  console.log(`[worker2] Running against Hedera testnet — waiting for bounties...`);
}

import { fileURLToPath } from "url";
const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  main().catch((err) => {
    console.error("Worker2 failed:", err);
    process.exit(1);
  });
}
