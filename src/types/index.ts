// ──────────────────────────────────────────────
// Bounty Strategy & Category
// ──────────────────────────────────────────────

export type BountyStrategy = "price" | "quality";

export type BountyCategory =
  | "crypto-price"
  | "travel"
  | "delivery"
  | "general"
  | string;

// ──────────────────────────────────────────────
// HCS Message Types (interface contract with Dev B)
// ──────────────────────────────────────────────

export interface BountyMessage {
  type: "bounty";
  taskId: string;
  description: string;
  reward: number;
  deadline: string; // ISO 8601
  requesterAddress: string;
  strategy?: BountyStrategy;  // "price" = cheapest bid wins, "quality" = best result wins (default)
  category?: BountyCategory;  // optional label for display/filtering
  maxWorkers?: number;         // max workers accepted for this bounty (overrides RequesterConfig.maxBidsToAccept)
}

export interface BidMessage {
  type: "bid";
  taskId: string;
  workerId: string;
  bidAmount: number;
  estimatedTime: string;
}

export interface ResultMessage {
  type: "result";
  taskId: string;
  workerId: string;
  data: PriceData;
}

export interface VerdictMessage {
  type: "verdict";
  taskId: string;
  winnerId: string;
  reason: string;
  paymentAmount: number;
}

// Published by the Requester after locking escrow so the Judge (running in a
// separate process) can discover the escrow info without manual wiring.
export interface EscrowMessage {
  type: "escrow";
  taskId: string;
  escrowAccountId: string;
  amount: number;
}

export type EvidenceKind =
  | "escrow-release" // HBAR escrow released to winner
  | "hts-reward"     // HIVE token reward sent to winner
  | "consolation";   // small HIVE consolation paid to a losing worker

export interface EvidenceMessage {
  type: "evidence";
  taskId: string;
  transactionId: string;
  kind?: EvidenceKind;
  recipient?: string; // account that received the transfer
  amount?: number;    // amount transferred (HBAR or HIVE)
  note?: string;      // optional human-readable note
}

export type HCSMessage =
  | BountyMessage
  | BidMessage
  | ResultMessage
  | VerdictMessage
  | EscrowMessage
  | EvidenceMessage;

// ──────────────────────────────────────────────
// Price Data
// ──────────────────────────────────────────────

export interface PriceData {
  sources: string[];
  prices: number[];
  average: number;
}

// ──────────────────────────────────────────────
// x402 Protocol Types
// ──────────────────────────────────────────────

export interface X402PaymentRequirements {
  x402Version: number;
  accepts: X402AcceptedPayment[];
}

export interface X402AcceptedPayment {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
}

export interface X402PaymentPayload {
  x402Version: number;
  scheme: string;
  payload: {
    signature: string;
    transactionId?: string;
  };
}

export interface X402PaymentResponse {
  success: boolean;
  transactionId: string;
}

export type PaymentSigner = (
  requirements: X402PaymentRequirements,
) => Promise<X402PaymentPayload>;

// ──────────────────────────────────────────────
// Worker State Machine
// ──────────────────────────────────────────────

export enum WorkerState {
  IDLE = "IDLE",
  DISCOVERING = "DISCOVERING",
  BIDDING = "BIDDING",
  EXECUTING = "EXECUTING",
  SUBMITTING = "SUBMITTING",
  COMPLETED = "COMPLETED",
  ERROR = "ERROR",
}

// ──────────────────────────────────────────────
// HCS Service Interface
// ──────────────────────────────────────────────

export type HCSMessageHandler = (message: HCSMessage, timestamp: string) => void;

export interface IHCSService {
  subscribe(topicId: string, onMessage: HCSMessageHandler, startTime?: Date): Promise<void>;
  publish(topicId: string, message: HCSMessage): Promise<void>;
  disconnect(): void;
}

// ──────────────────────────────────────────────
// Topic IDs Config
// ──────────────────────────────────────────────

export interface TopicIds {
  bounties: string;
  bids: string;
  results: string;
  verdicts: string;
}

// ──────────────────────────────────────────────
// Requester State Machine
// ──────────────────────────────────────────────

export enum RequesterState {
  IDLE = "IDLE",
  POSTING = "POSTING",
  AWAITING_BIDS = "AWAITING_BIDS",
  ESCROWING = "ESCROWING",
  AWAITING_RESULTS = "AWAITING_RESULTS",
  COMPLETED = "COMPLETED",
  ERROR = "ERROR",
}

// ──────────────────────────────────────────────
// Judge State Machine
// ──────────────────────────────────────────────

export enum JudgeState {
  IDLE = "IDLE",
  MONITORING = "MONITORING",
  EVALUATING = "EVALUATING",
  POSTING_VERDICT = "POSTING_VERDICT",
  RELEASING = "RELEASING",
  COMPLETED = "COMPLETED",
  ERROR = "ERROR",
}
