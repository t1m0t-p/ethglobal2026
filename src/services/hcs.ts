import {
  TopicMessageSubmitTransaction,
  TopicMessageQuery,
  type Client,
} from "@hiero-ledger/sdk";
import type { HCSMessage, HCSMessageHandler, IHCSService } from "../types/index.js";

// ──────────────────────────────────────────────
// Real HCS Service (Hedera Testnet)
// ──────────────────────────────────────────────

export class HCSService implements IHCSService {
  private client: Client;
  private subscriptionHandles: { unsubscribe: () => void }[] = [];

  constructor(client: Client) {
    this.client = client;
  }

  async subscribe(topicId: string, onMessage: HCSMessageHandler, startTime?: Date): Promise<void> {
    const query = new TopicMessageQuery().setTopicId(topicId);
    if (startTime) {
      query.setStartTime(startTime);
    }
    const handle = query.subscribe(this.client, null, (topicMessage) => {
        const raw = Buffer.from(topicMessage.contents).toString("utf-8");
        const timestamp = topicMessage.consensusTimestamp.toString();

        let parsed: HCSMessage;
        try {
          parsed = JSON.parse(raw) as HCSMessage;
        } catch {
          console.warn(`[hcs] Skipping non-JSON message on ${topicId}: ${raw.slice(0, 80)}`);
          return;
        }

        if (!parsed.type) {
          console.warn(`[hcs] Skipping message without 'type' field on ${topicId}`);
          return;
        }

        onMessage(parsed, timestamp);
      });

    this.subscriptionHandles.push(handle);
    console.log(`[hcs] Subscribed to topic ${topicId}`);
  }

  async publish(topicId: string, message: HCSMessage): Promise<void> {
    const payload = JSON.stringify(message);

    const txn = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(payload);

    const response = await txn.execute(this.client);
    const receipt = await response.getReceipt(this.client);

    console.log(
      `[hcs] Published ${message.type} to ${topicId} — status: ${receipt.status.toString()}`,
    );
  }

  disconnect(): void {
    for (const handle of this.subscriptionHandles) {
      handle.unsubscribe();
    }
    this.subscriptionHandles = [];
    console.log("[hcs] Disconnected all subscriptions");
  }
}

// ──────────────────────────────────────────────
// Mock HCS Service (in-memory, for testing)
// ──────────────────────────────────────────────

export class MockHCSService implements IHCSService {
  private handlers: Map<string, HCSMessageHandler[]> = new Map();
  private published: { topicId: string; message: HCSMessage }[] = [];

  async subscribe(topicId: string, onMessage: HCSMessageHandler, _startTime?: Date): Promise<void> {
    const existing = this.handlers.get(topicId) ?? [];
    existing.push(onMessage);
    this.handlers.set(topicId, existing);
    console.log(`[mock-hcs] Subscribed to topic ${topicId}`);
  }

  async publish(topicId: string, message: HCSMessage): Promise<void> {
    this.published.push({ topicId, message });
    console.log(`[mock-hcs] Published ${message.type} to ${topicId}`);

    // Deliver to subscribers of this topic
    const handlers = this.handlers.get(topicId) ?? [];
    const timestamp = new Date().toISOString();
    for (const handler of handlers) {
      handler(message, timestamp);
    }
  }

  /** Inject a message as if it came from Hedera — for testing */
  simulateMessage(topicId: string, message: HCSMessage): void {
    const handlers = this.handlers.get(topicId) ?? [];
    const timestamp = new Date().toISOString();
    console.log(`[mock-hcs] Simulating ${message.type} on topic ${topicId}`);
    for (const handler of handlers) {
      handler(message, timestamp);
    }
  }

  /** Get all published messages (for assertions) */
  getPublished(): ReadonlyArray<{ topicId: string; message: HCSMessage }> {
    return this.published;
  }

  disconnect(): void {
    this.handlers.clear();
    console.log("[mock-hcs] Disconnected");
  }
}
