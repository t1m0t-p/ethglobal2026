/**
 * hts.ts — Hedera Token Service operations for Hivera payment flow.
 *
 * Covers:
 *   - Token association (worker must associate before receiving HIVE)
 *   - Token transfer (Judge releases reward to winning Worker)
 */

import {
  TokenAssociateTransaction,
  TransferTransaction,
  AccountId,
  PrivateKey,
  TokenId,
  type Client,
} from "@hiero-ledger/sdk";

// ──────────────────────────────────────────────
// IHTSService — injectable interface for the Judge
// ──────────────────────────────────────────────

export interface IHTSService {
  transferToken(recipientId: string, amount: number): Promise<string>;
}

// ──────────────────────────────────────────────
// HTSService — real Hedera token transfers
// ──────────────────────────────────────────────

export class HTSService implements IHTSService {
  constructor(
    private readonly client: Client,
    private readonly tokenId: string,
    private readonly senderAccountId: string,
    private readonly senderPrivateKey: string,
  ) {}

  async transferToken(recipientId: string, amount: number): Promise<string> {
    return transferToken(
      this.client,
      this.tokenId,
      this.senderAccountId,
      this.senderPrivateKey,
      recipientId,
      amount,
    );
  }
}

// ──────────────────────────────────────────────
// Token Association
// ──────────────────────────────────────────────

/**
 * Associate a Hedera account with the HIVE token so it can receive transfers.
 * Must be called once per account before any token transfers to that account.
 * If the account is the token treasury (Requester), this is not needed.
 */
export async function associateToken(
  client: Client,
  accountId: string,
  privateKey: string,
  tokenId: string,
): Promise<void> {
  const txn = await new TokenAssociateTransaction()
    .setAccountId(AccountId.fromString(accountId))
    .setTokenIds([TokenId.fromString(tokenId)])
    .freezeWith(client)
    .sign(PrivateKey.fromStringDer(privateKey));

  const response = await txn.execute(client);
  const receipt = await response.getReceipt(client);

  console.log(
    `[hts] Associated token ${tokenId} with account ${accountId} — status: ${receipt.status.toString()}`,
  );
}

// ──────────────────────────────────────────────
// Token Transfer (payment release)
// ──────────────────────────────────────────────

/**
 * Transfer HIVE tokens from the Requester/treasury to the winning Worker.
 * Returns the transaction ID string for logging and Hashscan verification.
 */
export async function transferToken(
  client: Client,
  tokenId: string,
  senderAccountId: string,
  senderPrivateKey: string,
  receiverAccountId: string,
  amount: number,
): Promise<string> {
  const txn = await new TransferTransaction()
    .addTokenTransfer(
      TokenId.fromString(tokenId),
      AccountId.fromString(senderAccountId),
      -amount,
    )
    .addTokenTransfer(
      TokenId.fromString(tokenId),
      AccountId.fromString(receiverAccountId),
      amount,
    )
    .freezeWith(client)
    .sign(PrivateKey.fromStringDer(senderPrivateKey));

  const response = await txn.execute(client);
  const receipt = await response.getReceipt(client);
  const txId = response.transactionId.toString();

  console.log(
    `[hts] Transferred ${amount} HIVE from ${senderAccountId} → ${receiverAccountId}`,
  );
  console.log(`[hts] TxID: ${txId} — status: ${receipt.status.toString()}`);
  console.log(`[hts] Verify: https://hashscan.io/testnet/transaction/${txId}`);

  return txId;
}
