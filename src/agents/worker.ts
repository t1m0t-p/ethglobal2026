import type {
  IHCSService,
  TopicIds,
  PaymentSigner,
  BountyMessage,
  BidMessage,
  BidAcceptMessage,
  ResultMessage,
  VerdictMessage,
  HCSMessage,
  PriceData,
} from "../types/index.js";
import { WorkerState } from "../types/index.js";
import { fetchWithPayment, createMockPaymentSigner } from "../services/x402-client.js";
import { type IGeminiWorkerService, isCryptoTask } from "../services/gemini-worker.js";

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
  geminiWorker?: IGeminiWorkerService;
  // How long (ms) to wait for a bid-accept message after bidding before giving
  // up on a bounty. Defaults to 90_000 (90s). Workers that are not selected by
  // the Requester will silently drop the task after this timeout.
  acceptanceTimeoutMs?: number;
}

export class WorkerAgent {
  private state: WorkerState = WorkerState.IDLE;
  private readonly workerId: string;
  private readonly hcs: IHCSService;
  private readonly paymentSigner: PaymentSigner;
  private readonly x402Url: string;
  private readonly topicIds: TopicIds;
  private readonly bidAmount: number;
  private readonly acceptanceTimeoutMs: number;

  private readonly geminiWorker: IGeminiWorkerService | null;

  private currentBounty: BountyMessage | null = null;
  private lastResult: PriceData | null = null;
  private errorReason: string | null = null;
  private acceptanceTimer: ReturnType<typeof setTimeout> | null = null;
  // Resolved when a bid-accept message for the currentBounty arrives. The
  // processBounty() promise chain awaits this before executing the task.
  private acceptanceResolver: ((accepted: BidAcceptMessage) => void) | null = null;
  private acceptanceRejecter: ((reason: Error) => void) | null = null;

  constructor(config: WorkerConfig) {
    this.workerId = config.workerId;
    this.hcs = config.hcsService;
    this.paymentSigner = config.paymentSigner;
    this.x402Url = config.x402Url;
    this.topicIds = config.topicIds;
    this.bidAmount = config.bidAmount ?? 50;
    this.acceptanceTimeoutMs = config.acceptanceTimeoutMs ?? 90_000;
    this.geminiWorker = config.geminiWorker ?? null;
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
    this.clearAcceptanceWait();
    this.currentBounty = null;
    this.lastResult = null;
    this.errorReason = null;
    this.transition(WorkerState.IDLE);
  }

  private clearAcceptanceWait(): void {
    if (this.acceptanceTimer !== null) {
      clearTimeout(this.acceptanceTimer);
      this.acceptanceTimer = null;
    }
    this.acceptanceResolver = null;
    this.acceptanceRejecter = null;
  }

  // ── Main entrypoint ──

  async start(): Promise<void> {
    if (this.state !== WorkerState.IDLE) {
      throw new Error(`Cannot start worker in state ${this.state} — call reset() first`);
    }

    this.transition(WorkerState.DISCOVERING);

    // Subscribe to bounties starting from slightly before now.
    // This avoids replaying old unexpired bounties from previous sessions that would
    // cause the worker to get stuck waiting for acceptance (90s timeout) while missing
    // the current bounty — which triggers the requester's bid timeout and causes ERROR.
    const bountyStartTime = new Date(Date.now() - 60_000); // 60s look-back window
    await this.hcs.subscribe(this.topicIds.bounties, (message: HCSMessage) => {
      if (message.type === "bounty") {
        this.handleBounty(message);
      }
    }, bountyStartTime);

    // Subscribe to bids topic so we can receive our own bid-accept from the
    // Requester and know we are authorized to execute. Own bid echoes are
    // ignored — we only care about bid-accept messages targeting this worker.
    await this.hcs.subscribe(this.topicIds.bids, (message: HCSMessage) => {
      if (message.type === "bid-accept") {
        this.handleBidAccept(message);
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

  // Returns true if this worker can execute the given bounty
  private canExecuteTask(bounty: BountyMessage): boolean {
    if (this.geminiWorker) {
      return this.geminiWorker.supportsTask(bounty.description, bounty.category);
    }
    // Legacy path (no geminiWorker): only handle crypto-price tasks via x402
    return isCryptoTask(bounty.description, bounty.category);
  }

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

    // Check capability BEFORE bidding — never bid on tasks we can't execute
    if (!this.canExecuteTask(bounty)) {
      console.log(
        `[worker:${this.workerId}] Skipping bounty ${bounty.taskId} — ` +
        `task requires GEMINI_API_KEY: "${bounty.description.slice(0, 70)}"`,
      );
      return;
    }

    console.log(
      `[worker:${this.workerId}] Found bounty: ${bounty.taskId} — reward: ${bounty.reward} HBAR`,
    );
    this.currentBounty = bounty;

    // Process bounty asynchronously
    this.processBounty(bounty).catch((err) => {
      this.transitionToError(err instanceof Error ? err.message : String(err));
      // Recover and listen for next bounty
      this.currentBounty = null;
      this.lastResult = null;
      this.errorReason = null;
      this.transition(WorkerState.DISCOVERING);
      console.log(`[worker:${this.workerId}] Recovered from error — listening for bounties...`);
    });
  }

  private async processBounty(bounty: BountyMessage): Promise<void> {
    // Step 1: Submit bid
    await this.submitBid(bounty);

    // Step 2: Wait for the Requester to accept this specific bid.
    // This is the negotiation handshake — workers that are not selected will
    // time out here and drop the bounty without burning API credits on execution.
    const accept = await this.waitForAcceptance(bounty);
    console.log(
      `[worker:${this.workerId}] Bid accepted for ${bounty.taskId} @ ${accept.acceptedAmount} HBAR — starting execution`,
    );

    // Step 3: Execute task (Gemini-driven or legacy x402)
    const priceData = await this.executeTask(bounty);

    // Step 4: Submit result
    await this.submitResult(bounty, priceData);
  }

  // ── Acceptance handshake ──

  private waitForAcceptance(bounty: BountyMessage): Promise<BidAcceptMessage> {
    this.transition(WorkerState.AWAITING_ACCEPTANCE);
    console.log(
      `[worker:${this.workerId}] Awaiting bid acceptance for ${bounty.taskId} (timeout ${this.acceptanceTimeoutMs}ms)`,
    );

    return new Promise<BidAcceptMessage>((resolve, reject) => {
      this.acceptanceResolver = (msg) => {
        this.clearAcceptanceWait();
        resolve(msg);
      };
      this.acceptanceRejecter = (err) => {
        this.clearAcceptanceWait();
        reject(err);
      };
      this.acceptanceTimer = setTimeout(() => {
        const rej = this.acceptanceRejecter;
        this.clearAcceptanceWait();
        if (rej) {
          rej(
            new Error(
              `Bid not accepted within ${this.acceptanceTimeoutMs}ms — dropping task ${bounty.taskId}`,
            ),
          );
        }
      }, this.acceptanceTimeoutMs);
    });
  }

  private handleBidAccept(msg: BidAcceptMessage): void {
    // Only care about our own bid on our current task.
    if (!this.currentBounty || msg.taskId !== this.currentBounty.taskId) return;
    if (msg.workerId !== this.workerId) return;
    if (this.state !== WorkerState.AWAITING_ACCEPTANCE) {
      console.log(
        `[worker:${this.workerId}] Ignoring bid-accept for ${msg.taskId} — state: ${this.state}`,
      );
      return;
    }
    const resolver = this.acceptanceResolver;
    if (resolver) resolver(msg);
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

  // ── Task execution (Gemini 2.5 Flash + Hedera Agent Kit or legacy x402) ──

  private async executeTask(bounty: BountyMessage): Promise<PriceData> {
    this.transition(WorkerState.EXECUTING);

    if (this.geminiWorker) {
      console.log(
        `[worker:${this.workerId}] Executing via Gemini 2.5 Flash — task: "${bounty.description}"`,
      );
      const priceData = await this.geminiWorker.executeWithDescription(
        bounty.description,
        { taskId: bounty.taskId, reward: bounty.reward },
      );
      console.log(
        `[worker:${this.workerId}] Gemini result — ${priceData.sources.join(", ")} avg: $${priceData.average}`,
      );
      this.lastResult = priceData;
      return priceData;
    }

    // Legacy path — only for crypto-price tasks (x402 always returns price data)
    if (!isCryptoTask(bounty.description, bounty.category)) {
      throw new Error(
        `Cannot execute non-crypto task without GEMINI_API_KEY: "${bounty.description.slice(0, 80)}"`,
      );
    }
    console.log(`[worker:${this.workerId}] Fetching crypto price via x402 at ${this.x402Url}`);

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

  // ── Verdict handling ──

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

    // Ready for next bounty
    this.currentBounty = null;
    this.lastResult = null;
    this.errorReason = null;
    this.transition(WorkerState.DISCOVERING);
    console.log(`[worker:${this.workerId}] Listening for bounties...`);
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
  const { createGeminiWorkerService } = await import("../services/gemini-worker.js");
  const { createRealPaymentSigner } = await import("../services/x402-client.js");
  const { PrivateKey } = await import("@hiero-ledger/sdk");

  const client = createHederaClient();
  const topicIds = loadTopicIds();
  const workerConfig = loadWorkerConfig();
  const x402Url = process.env.X402_SERVER_URL || "http://localhost:4020";

  const hcsService = new HCSService(client);
  const paymentSigner = createRealPaymentSigner(
    client,
    workerConfig.accountId,
    PrivateKey.fromStringDer(workerConfig.privateKey),
  );
  const x402FullUrl = `${x402Url}/api/v1/btc-price`;

  // Factory : active GeminiWorkerService si GEMINI_API_KEY est présent, sinon Mock
  const geminiWorker = createGeminiWorkerService(x402FullUrl, paymentSigner, {
    hederaAccountId: workerConfig.accountId,
    hederaPrivateKey: workerConfig.privateKey,
  });

  const worker = new WorkerAgent({
    workerId: workerConfig.accountId,
    hcsService,
    paymentSigner,
    x402Url: x402FullUrl,
    topicIds,
    geminiWorker,
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
import { fileURLToPath } from "url";
const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  main().catch((err) => {
    console.error("Worker failed:", err);
    process.exit(1);
  });
}
