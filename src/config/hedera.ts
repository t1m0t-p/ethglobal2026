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
    accountId: requireEnv("WORKER_ACCOUNT_ID"),
    privateKey: requireEnv("WORKER_PRIVATE_KEY"),
  };
}

export function loadRequesterConfig(): { accountId: string; privateKey: string } {
  return {
    accountId: requireEnv("REQUESTER_ACCOUNT_ID"),
    privateKey: requireEnv("REQUESTER_PRIVATE_KEY"),
  };
}

export function loadJudgeConfig(): {
  accountId: string;
  privateKey: string;
  anthropicApiKey: string;
} {
  return {
    accountId: requireEnv("JUDGE_ACCOUNT_ID"),
    privateKey: requireEnv("JUDGE_PRIVATE_KEY"),
    anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),
  };
}
