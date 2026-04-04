import {
  TransferTransaction,
  ScheduleCreateTransaction,
  ScheduleSignTransaction,
  ScheduleId,
  AccountId,
  Hbar,
  PrivateKey,
  type Client,
} from "@hiero-ledger/sdk";

// ──────────────────────────────────────────────
// Escrow Info — returned by createEscrow(), passed to releaseEscrow()
// ──────────────────────────────────────────────

export interface EscrowInfo {
  scheduleId: string;        // "0.0.XXXXX" — Hedera schedule ID
  taskId: string;
  amount: number;            // HBAR amount locked
  recipientAddress: string;  // winner's account ID
}

// ──────────────────────────────────────────────
// EscrowService — real Hedera Scheduled Transactions
// ──────────────────────────────────────────────

export class EscrowService {
  private readonly client: Client;
  private readonly operatorKey: PrivateKey;

  constructor(client: Client, operatorKey: PrivateKey) {
    this.client = client;
    this.operatorKey = operatorKey;
  }

  // Lock HBAR by creating an unsigned Scheduled Transaction.
  // The schedule is created without the operator signature — it stays
  // in PENDING state until Judge calls releaseEscrow(), which signs it
  // and triggers the on-chain HBAR transfer to the winner.
  async createEscrow(
    taskId: string,
    senderAccountId: string,
    recipientAccountId: string,
    amountHbar: number,
  ): Promise<EscrowInfo> {
    // Build the inner transfer: sender pays, recipient receives
    const innerTransfer = new TransferTransaction()
      .addHbarTransfer(AccountId.fromString(senderAccountId), new Hbar(-amountHbar))
      .addHbarTransfer(AccountId.fromString(recipientAccountId), new Hbar(amountHbar));

    // Wrap in a Scheduled Transaction — does NOT auto-execute yet
    const response = await new ScheduleCreateTransaction()
      .setScheduledTransaction(innerTransfer)
      .setScheduleMemo(`AgentBazaar escrow — ${taskId}`)
      .execute(this.client);

    const receipt = await response.getReceipt(this.client);
    const scheduleId = receipt.scheduleId!.toString();

    console.log(
      `[escrow] Created schedule ${scheduleId} — ${amountHbar} HBAR locked for task ${taskId}`,
    );

    return { scheduleId, taskId, amount: amountHbar, recipientAddress: recipientAccountId };
  }

  // Release locked HBAR by signing the schedule with the operator key.
  // Once signed, the TransferTransaction executes immediately on Hedera.
  async releaseEscrow(info: EscrowInfo): Promise<string> {
    const response = await new ScheduleSignTransaction()
      .setScheduleId(ScheduleId.fromString(info.scheduleId))
      .freezeWith(this.client)
      .sign(this.operatorKey)
      .then((tx) => tx.execute(this.client));

    const receipt = await response.getReceipt(this.client);
    const txnId = receipt.transactionId?.toString() ?? response.transactionId.toString();

    console.log(
      `[escrow] Released schedule ${info.scheduleId} — ${info.amount} HBAR sent to ${info.recipientAddress}`,
    );

    return txnId;
  }
}

// ──────────────────────────────────────────────
// MockEscrowService — in-memory, no Hedera required
// ──────────────────────────────────────────────

export class MockEscrowService {
  private releasedIds = new Set<string>();
  private mockScheduleCounter = 1000;

  async createEscrow(
    taskId: string,
    _senderAccountId: string,
    recipientAccountId: string,
    amountHbar: number,
  ): Promise<EscrowInfo> {
    const scheduleId = `0.0.MOCK_SCHEDULE_${this.mockScheduleCounter++}`;
    const info: EscrowInfo = {
      scheduleId,
      taskId,
      amount: amountHbar,
      recipientAddress: recipientAccountId,
    };
    console.log(
      `[mock-escrow] Created schedule ${scheduleId} — ${amountHbar} HBAR locked for task ${taskId}`,
    );
    return info;
  }

  async releaseEscrow(info: EscrowInfo): Promise<string> {
    this.releasedIds.add(info.scheduleId);
    const txnId = `mock-txn-${Date.now()}`;
    console.log(
      `[mock-escrow] Released schedule ${info.scheduleId} — ${info.amount} HBAR sent to ${info.recipientAddress} (txn: ${txnId})`,
    );
    return txnId;
  }

  isReleased(scheduleId: string): boolean {
    return this.releasedIds.has(scheduleId);
  }
}
