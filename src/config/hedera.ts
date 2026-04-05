import { Client, AccountId, PrivateKey } from "@hiero-ledger/sdk";
import dotenv from "dotenv";
import type { TopicIds } from "../types/index.js";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Falls back to HEDERA_ACCOUNT_ID / HEDERA_PRIVATE_KEY if role-specific vars are absent. */
function envWithFallback(specific: string, fallback: string): string {
  return process.env[specific] || requireEnv(fallback);
}

export function createHederaClient(): Client {
  const accountId = requireEnv("HEDERA_ACCOUNT_ID");
  const privateKey = requireEnv("HEDERA_PRIVATE_KEY");
  const network = process.env.HEDERA_NETWORK || "testnet";

  const client =
    network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

  client.setOperator(
    AccountId.fromString(accountId),
    PrivateKey.fromStringDer(privateKey),
  );

  console.log(`[hedera] Client initialized for ${network} — account ${accountId}`);
  return client;
}

export function loadTopicIds(): TopicIds {
  return {
    bounties: requireEnv("HCS_BOUNTY_TOPIC_ID"),
    bids: requireEnv("HCS_BID_TOPIC_ID"),
    results: requireEnv("HCS_RESULT_TOPIC_ID"),
    verdicts: requireEnv("HCS_VERDICT_TOPIC_ID"),
  };
}

export function loadWorkerConfig(): { accountId: string; privateKey: string } {
  return {
    accountId: envWithFallback("WORKER_ACCOUNT_ID", "HEDERA_ACCOUNT_ID"),
    privateKey: envWithFallback("WORKER_PRIVATE_KEY", "HEDERA_PRIVATE_KEY"),
  };
}

export function loadWorker2Config(): {
  accountId: string;
  privateKey: string;
  geminiApiKey: string | undefined;
} {
  return {
    accountId:
      process.env.WORKER2_ACCOUNT_ID ||
      envWithFallback("WORKER_ACCOUNT_ID", "HEDERA_ACCOUNT_ID"),
    privateKey:
      process.env.WORKER2_PRIVATE_KEY ||
      envWithFallback("WORKER_PRIVATE_KEY", "HEDERA_PRIVATE_KEY"),
    geminiApiKey: process.env.WORKER2_GEMINI_API_KEY,
  };
}

export function loadRequesterConfig(): { accountId: string; privateKey: string } {
  return {
    accountId: envWithFallback("REQUESTER_ACCOUNT_ID", "HEDERA_ACCOUNT_ID"),
    privateKey: envWithFallback("REQUESTER_PRIVATE_KEY", "HEDERA_PRIVATE_KEY"),
  };
}

export function loadJudgeConfig(): {
  accountId: string;
  payerPrivateKey: string;
  tokenId: string;
  anthropicApiKey: string | undefined;
} {
  return {
    accountId: envWithFallback("JUDGE_ACCOUNT_ID", "HEDERA_ACCOUNT_ID"),
    payerPrivateKey: envWithFallback("JUDGE_PRIVATE_KEY", "HEDERA_PRIVATE_KEY"),
    tokenId: requireEnv("HTS_TOKEN_ID"),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  };
}

export function loadEscrowConfig(): {
  escrowAccountId: string;
  escrowPrivateKey: string;
} {
  return {
    escrowAccountId: requireEnv("ESCROW_ACCOUNT_ID"),
    escrowPrivateKey: requireEnv("ESCROW_PRIVATE_KEY"),
  };
}
