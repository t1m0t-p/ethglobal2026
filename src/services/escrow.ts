import {
  TransferTransaction,
  AccountId,
  Hbar,
  PrivateKey,
  type Client,
} from "@hiero-ledger/sdk";

// ──────────────────────────────────────────────
// Escrow Info — escrow account model
// ──────────────────────────────────────────────
// Requester deposits HBAR to the escrow account.
// Judge releases from escrow account to the winner at verdict time.

export interface EscrowInfo {
  escrowAccountId: string;  // "0.0.XXXXX" — account holding the locked HBAR
  taskId: string;
  amount: number;           // HBAR amount locked
}

// ──────────────────────────────────────────────
// EscrowService — Hedera account-based escrow
// ──────────────────────────────────────────────
// Model:
//   - Escrow account exists with judge's key as signatory
//   - Requester transfers HBAR to escrow account (deposit, no escrow key needed)
//   - Judge transfers from escrow account to winner (release, judge key signs)
//   - Recipient is known at release time, ensuring correct winner payment

export class EscrowService {
  private readonly client: Client;
  private readonly escrowAccountId: string;
  private readonly escrowKey: PrivateKey;

  constructor(client: Client, escrowAccountId: string, escrowKey: PrivateKey) {
    this.client = client;
    this.escrowAccountId = escrowAccountId;
    this.escrowKey = escrowKey;
  }

  // Lock HBAR by transferring from requester to escrow account.
  // The requester signs this transfer with their own key (normal outgoing transfer).
  // The escrow account now holds the HBAR until the judge releases it to the winner.
  async createEscrow(
    taskId: string,
    senderAccountId: string,
    amountHbar: number,
    requesterKey: PrivateKey,
  ): Promise<EscrowInfo> {
    // Build transfer: sender → escrow account, signed by requester
    const depositTx = new TransferTransaction()
      .addHbarTransfer(AccountId.fromString(senderAccountId), new Hbar(-amountHbar))
      .addHbarTransfer(AccountId.fromString(this.escrowAccountId), new Hbar(amountHbar))
      .setTransactionMemo(`Hivera escrow deposit — task ${taskId}`)
      .freezeWith(this.client);

    console.log(
      `[escrow] Deposit prepared — ${amountHbar} HBAR to escrow ${this.escrowAccountId} for task ${taskId}`,
    );

    const signedTx = await depositTx.sign(requesterKey);
    const response = await signedTx.execute(this.client);
    await response.getReceipt(this.client);

    return { escrowAccountId: this.escrowAccountId, taskId, amount: amountHbar };
  }

  // Release locked HBAR by transferring from escrow account to the winner.
  // The judge signs this transfer with the escrow account's key (which judge controls).
  // Winner is determined at release time, ensuring correct payment.
  async releaseEscrow(info: EscrowInfo, winnerId: string): Promise<string> {
    const releaseTx = new TransferTransaction()
      .addHbarTransfer(AccountId.fromString(info.escrowAccountId), new Hbar(-info.amount))
      .addHbarTransfer(AccountId.fromString(winnerId), new Hbar(info.amount))
      .setTransactionMemo(`Hivera escrow release — task ${info.taskId}, winner ${winnerId}`)
      .freezeWith(this.client);

    const signedTx = await releaseTx.sign(this.escrowKey);
    const response = await signedTx.execute(this.client);
    await response.getReceipt(this.client);
    const txnId = response.transactionId.toString();

    console.log(
      `[escrow] Released ${info.amount} HBAR from escrow to winner ${winnerId} for task ${info.taskId} — txn: ${txnId}`,
    );

    return txnId;
  }
}

// ──────────────────────────────────────────────
// MockEscrowService — in-memory, no Hedera required
// ──────────────────────────────────────────────

export class MockEscrowService {
  private deposits: Map<string, EscrowInfo> = new Map();
  private releases: Map<string, { winnerId: string; txnId: string }> = new Map();

  async createEscrow(
    taskId: string,
    _senderAccountId: string,
    amountHbar: number,
    _requesterKey: PrivateKey,
  ): Promise<EscrowInfo> {
    const escrowAccountId = `0.0.MOCK_ESCROW_${taskId}`;
    const info: EscrowInfo = {
      escrowAccountId,
      taskId,
      amount: amountHbar,
    };
    this.deposits.set(taskId, info);
    console.log(
      `[mock-escrow] Deposited ${amountHbar} HBAR to mock escrow for task ${taskId}`,
    );
    return info;
  }

  async releaseEscrow(info: EscrowInfo, winnerId: string): Promise<string> {
    const txnId = `mock-txn-${Date.now()}`;
    this.releases.set(info.taskId, { winnerId, txnId });
    console.log(
      `[mock-escrow] Released ${info.amount} HBAR to winner ${winnerId} for task ${info.taskId} (txn: ${txnId})`,
    );
    return txnId;
  }

  isReleased(taskId: string): boolean {
    return this.releases.has(taskId);
  }

  getRelease(taskId: string): { winnerId: string; txnId: string } | undefined {
    return this.releases.get(taskId);
  }
}
