/**
 * setup.ts — One-shot bootstrap script for Hivera on Hedera testnet.
 *
 * Run once before the demo:
 *   npm run setup
 *
 * Creates:
 *   - 4 HCS topics (bounties, bids, results, verdicts)
 *   - 1 HTS fungible token (HIVE) with 1000 initial supply
 *
 * Prints all IDs to stdout. Copy them into your .env file.
 */

import {
  TopicCreateTransaction,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  AccountId,
  PrivateKey,
  AccountCreateTransaction,
  Hbar,
} from "@hiero-ledger/sdk";
import { createHederaClient } from "../config/hedera.js";

async function createTopic(
  client: ReturnType<typeof createHederaClient>,
  memo: string,
): Promise<string> {
  const txn = new TopicCreateTransaction().setTopicMemo(memo);
  const response = await txn.execute(client);
  const receipt = await response.getReceipt(client);
  const topicId = receipt.topicId!.toString();
  console.log(`  ✓ ${memo}: ${topicId}`);
  return topicId;
}

async function createEscrowAccount(
  client: ReturnType<typeof createHederaClient>,
  escrowKey: PrivateKey,
): Promise<{ accountId: string; privateKey: string }> {
  const txn = new AccountCreateTransaction()
    .setKey(escrowKey.publicKey)
    .setInitialBalance(new Hbar(10)); // seed with 10 HBAR for transaction fees

  const response = await txn.execute(client);
  const receipt = await response.getReceipt(client);
  const accountId = receipt.accountId!.toString();
  console.log(`  ✓ Escrow account: ${accountId}`);
  return { accountId, privateKey: escrowKey.toStringDer() };
}

async function main(): Promise<void> {
  console.log("=== Hivera Testnet Setup ===\n");

  const client = createHederaClient();
  const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID!);
  const operatorKey = PrivateKey.fromStringDer(process.env.HEDERA_PRIVATE_KEY!);

  // ── Create HCS Topics ──────────────────────────────────────────────────────

  console.log("Creating HCS topics...");
  const bountyTopicId = await createTopic(client, "hivera-bounties");
  const bidTopicId = await createTopic(client, "hivera-bids");
  const resultTopicId = await createTopic(client, "hivera-results");
  const verdictTopicId = await createTopic(client, "hivera-verdicts");

  // ── Create HTS Token ───────────────────────────────────────────────────────

  console.log("\nCreating HIVE token (HTS)...");
  const tokenTxn = new TokenCreateTransaction()
    .setTokenName("Hivera Token")
    .setTokenSymbol("HIVE")
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Finite)
    .setInitialSupply(1_000_000)
    .setMaxSupply(10_000_000)
    .setDecimals(0)
    .setTreasuryAccountId(operatorId)
    .setAdminKey(operatorKey.publicKey)
    .setSupplyKey(operatorKey.publicKey);

  const tokenResponse = await tokenTxn.execute(client);
  const tokenReceipt = await tokenResponse.getReceipt(client);
  const tokenId = tokenReceipt.tokenId!.toString();
  console.log(`  ✓ HIVE token: ${tokenId}`);

  // ── Create Escrow Account ──────────────────────────────────────────────────
  // The escrow account holds HBAR during task execution and is controlled by the Judge

  console.log("\nCreating escrow account...");
  const escrowKey = PrivateKey.generate();
  const escrow = await createEscrowAccount(client, escrowKey);

  // ── Print .env block ───────────────────────────────────────────────────────

  console.log(`
=== Copy the following into your .env file ===

HCS_BOUNTY_TOPIC_ID=${bountyTopicId}
HCS_BID_TOPIC_ID=${bidTopicId}
HCS_RESULT_TOPIC_ID=${resultTopicId}
HCS_VERDICT_TOPIC_ID=${verdictTopicId}

HTS_TOKEN_ID=${tokenId}

ESCROW_ACCOUNT_ID=${escrow.accountId}
ESCROW_PRIVATE_KEY=${escrow.privateKey}

==============================================
`);

  console.log("Setup complete. Verify transactions at https://hashscan.io/testnet");
  client.close();
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
