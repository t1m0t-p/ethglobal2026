import type {
  IHCSService,
  TopicIds,
  PaymentSigner,
  BountyMessage,
  BidMessage,
  ResultMessage,
  VerdictMessage,
  HCSMessage,
  PriceData,
} from "../types/index.js";
import { WorkerState } from "../types/index.js";
import { fetchWithPayment, createMockPaymentSigner } from "../services/x402-client.js";

// ──────────────────────────────────────────────
// Worker Agent — State Machine
// ──────────────────────────────────────────────

export interface WorkerConfig {
  workerId: string;
  hcsService: IHCSService;
  paymentSigner: PaymentSigner;
  x402Url: string;
  topicIds: TopicIds;
  bidAmount?: number;
}

export class WorkerAgent {
  private state: WorkerState = WorkerState.IDLE;
  private readonly workerId: string;
  private readonly hcs: IHCSService;
  private readonly paymentSigner: PaymentSigner;
  private readonly x402Url: string;
  private readonly topicIds: TopicIds;
  private readonly bidAmount: number;

  private currentBounty: BountyMessage | null = null;
  private lastResult: PriceData | null = null;
  private errorReason: string | null = null;

  constructor(config: WorkerConfig) {
    this.workerId = config.workerId;
    this.hcs = config.hcsService;
    this.paymentSigner = config.paymentSigner;
    this.x402Url = config.x402Url;
    this.topicIds = config.topicIds;
    this.bidAmount = config.bidAmount ?? 50;
  }

  getState(): WorkerState {
    return this.state;
  }

  getErrorReason(): string | null {
    return this.errorReason;
  }

  // ── State transitions ──

  private transition(to: WorkerState): void {
    console.log(`[worker:${this.workerId}] ${this.state} → ${to}`);
    this.state = to;
  }

  private transitionToError(reason: string): void {
    this.errorReason = reason;
    console.error(`[worker:${this.workerId}] ${this.state} → ERROR: ${reason}`);
    this.state = WorkerState.ERROR;
  }

  reset(): void {
    this.currentBounty = null;
    this.lastResult = null;
    this.errorReason = null;
    this.transition(WorkerState.IDLE);
  }

  // ── Main entrypoint ──

  async start(): Promise<void> {
    if (this.state !== WorkerState.IDLE) {
      throw new Error(`Cannot start worker in state ${this.state} — call reset() first`);
    }

    this.transition(WorkerState.DISCOVERING);

    // Subscribe to bounties
    await this.hcs.subscribe(this.topicIds.bounties, (message: HCSMessage) => {
      if (message.type === "bounty") {
        this.handleBounty(message);
      }
    });

    // Subscribe to verdicts (informational)
    await this.hcs.subscribe(this.topicIds.verdicts, (message: HCSMessage) => {
      if (message.type === "verdict") {
        this.handleVerdict(message);
      }
    });

    console.log(`[worker:${this.workerId}] Listening for bounties...`);
  }

  // ── Bounty handling ──

  private handleBounty(bounty: BountyMessage): void {
    if (this.state !== WorkerState.DISCOVERING) {
      console.log(
        `[worker:${this.workerId}] Ignoring bounty ${bounty.taskId} — busy (state: ${this.state})`,
      );
      return;
    }

    // Check deadline
    const deadline = new Date(bounty.deadline);
    if (deadline.getTime() < Date.now()) {
      console.log(`[worker:${this.workerId}] Skipping expired bounty ${bounty.taskId}`);
      return;
    }

    console.log(
      `[worker:${this.workerId}] Found bounty: ${bounty.taskId} — reward: ${bounty.reward} HBAR`,
    );
    this.currentBounty = bounty;

    // Process bounty asynchronously
    this.processBounty(bounty).catch((err) => {
      this.transitionToError(err instanceof Error ? err.message : String(err));
    });
  }

  private async processBounty(bounty: BountyMessage): Promise<void> {
    // Step 1: Submit bid
    await this.submitBid(bounty);

    // Step 2: Execute task (x402 price fetch)
    const priceData = await this.executeTask();

    // Step 3: Submit result
    await this.submitResult(bounty, priceData);
  }

  // ── Bid submission ──

  private async submitBid(bounty: BountyMessage): Promise<void> {
    this.transition(WorkerState.BIDDING);

    const bid: BidMessage = {
      type: "bid",
      taskId: bounty.taskId,
      workerId: this.workerId,
      bidAmount: this.bidAmount,
      estimatedTime: "30s",
    };

    await this.hcs.publish(this.topicIds.bids, bid);
    console.log(
      `[worker:${this.workerId}] Bid submitted: ${this.bidAmount} HBAR for ${bounty.taskId}`,
    );
  }

  // ── Task execution (x402 price fetch) ──

  private async executeTask(): Promise<PriceData> {
    this.transition(WorkerState.EXECUTING);

    console.log(`[worker:${this.workerId}] Fetching BTC price via x402 at ${this.x402Url}`);

    const { priceData, paymentResponse } = await fetchWithPayment(
      this.x402Url,
      this.paymentSigner,
    );

    console.log(
      `[worker:${this.workerId}] Got prices from ${priceData.sources.join(", ")} — average: $${priceData.average}`,
    );
    console.log(
      `[worker:${this.workerId}] Payment txn: ${paymentResponse.transactionId}`,
    );

    this.lastResult = priceData;
    return priceData;
  }

  // ── Result submission ──

  private async submitResult(bounty: BountyMessage, priceData: PriceData): Promise<void> {
    this.transition(WorkerState.SUBMITTING);

    const result: ResultMessage = {
      type: "result",
      taskId: bounty.taskId,
      workerId: this.workerId,
      data: priceData,
    };

    await this.hcs.publish(this.topicIds.results, result);
    this.transition(WorkerState.COMPLETED);

    console.log(
      `[worker:${this.workerId}] Result submitted for ${bounty.taskId} — awaiting verdict`,
    );
  }

  // ── Verdict handling (informational) ──

  private handleVerdict(verdict: VerdictMessage): void {
    if (!this.currentBounty || verdict.taskId !== this.currentBounty.taskId) {
      return;
    }

    if (verdict.winnerId === this.workerId) {
      console.log(
        `[worker:${this.workerId}] 🏆 WON bounty ${verdict.taskId}! Payment: ${verdict.paymentAmount} HBAR — "${verdict.reason}"`,
      );
    } else {
      console.log(
        `[worker:${this.workerId}] Lost bounty ${verdict.taskId} — winner: ${verdict.winnerId}`,
      );
    }
  }

  // ── Shutdown ──

  stop(): void {
    this.hcs.disconnect();
    console.log(`[worker:${this.workerId}] Stopped`);
  }
}

// ──────────────────────────────────────────────
// CLI entrypoint — run against real Hedera
// ──────────────────────────────────────────────

async function main(): Promise<void> {
  // Dynamic imports to avoid requiring .env when imported as module
  const { createHederaClient, loadTopicIds, loadWorkerConfig } = await import(
    "../config/hedera.js"
  );
  const { HCSService } = await import("../services/hcs.js");

  const client = createHederaClient();
  const topicIds = loadTopicIds();
  const workerConfig = loadWorkerConfig();
  const x402Url = process.env.X402_SERVER_URL || "http://localhost:4020";

  const hcsService = new HCSService(client);

  const worker = new WorkerAgent({
    workerId: workerConfig.accountId,
    hcsService,
    paymentSigner: createMockPaymentSigner(workerConfig.accountId),
    x402Url: `${x402Url}/api/v1/btc-price`,
    topicIds,
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down worker...");
    worker.stop();
    process.exit(0);
  });

  await worker.start();
  console.log(`[worker] Running against Hedera testnet — waiting for bounties...`);
}

// Run if executed directly
const isDirectRun =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isDirectRun) {
  main().catch((err) => {
    console.error("Worker failed:", err);
    process.exit(1);
  });
}
