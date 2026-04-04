import { TopicCreateTransaction } from "@hiero-ledger/sdk";

// ──────────────────────────────────────────────
// create-topics — one-time HCS topic setup
//
// Run once before the hackathon. Prints the 4 topic IDs
// that all agents need. Paste output into .env.
//
// Usage: npm run topics:create
// ──────────────────────────────────────────────

async function main(): Promise<void> {
  const { createHederaClient } = await import("../config/hedera.js");

  console.log("═══════════════════════════════════════════");
  console.log("  AgentBazaar — HCS Topic Setup");
  console.log("═══════════════════════════════════════════\n");

  const client = createHederaClient();

  const topics: Array<{ name: string; envKey: string }> = [
    { name: "bounties", envKey: "HCS_BOUNTY_TOPIC_ID" },
    { name: "bids",     envKey: "HCS_BID_TOPIC_ID" },
    { name: "results",  envKey: "HCS_RESULT_TOPIC_ID" },
    { name: "verdicts", envKey: "HCS_VERDICT_TOPIC_ID" },
  ];

  const created: Array<{ envKey: string; topicId: string }> = [];

  for (const topic of topics) {
    process.stdout.write(`Creating ${topic.name} topic... `);

    const response = await new TopicCreateTransaction()
      .setTopicMemo(`AgentBazaar — ${topic.name}`)
      .execute(client);

    const receipt = await response.getReceipt(client);
    const topicId = receipt.topicId!.toString();

    created.push({ envKey: topic.envKey, topicId });
    console.log(`✓ ${topicId}`);
  }

  client.close();

  console.log("\n─── Add these to your .env file ───────────");
  for (const { envKey, topicId } of created) {
    console.log(`${envKey}=${topicId}`);
  }
  console.log("─────────────────────────────────────────────");
  console.log("\nShare these topic IDs with Dev A and Dev C.\n");
}

// Run if executed directly
const isDirectRun =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isDirectRun) {
  main().catch((err) => {
    console.error("Topic creation failed:", err);
    process.exit(1);
  });
}
