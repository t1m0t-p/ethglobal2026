import type {
  IHCSService,
  TopicIds,
  BountyMessage,
  BidMessage,
  ResultMessage,
  VerdictMessage,
  HCSMessage,
} from "../types/index.js";
import { JudgeState } from "../types/index.js";
import { EscrowService, MockEscrowService, type EscrowInfo } from "../services/escrow.js";
import { LLMService, MockLLMService } from "../services/llm.js";
import type { IHTSService } from "../services/hts.js";

// ──────────────────────────────────────────────
// Judge Agent — State Machine
// ──────────────────────────────────────────────

export interface JudgeConfig {
  accountId: string;
  hcsService: IHCSService;
  topicIds: TopicIds;
  llmService: LLMService | MockLLMService;
  escrowService: EscrowService | MockEscrowService;
  htsService?: IHTSService; // optional — if provided, transfers HIVE tokens to winner on verdict
  resultsWaitMs?: number; // how long to collect results before evaluating (default 30_000)
}

export class JudgeAgent {
  private state: JudgeState = JudgeState.IDLE;
  private readonly accountId: string;
  private readonly hcs: IHCSService;
  private readonly topicIds: TopicIds;
  private readonly llmService: LLMService | MockLLMService;
  private readonly escrowService: EscrowService | MockEscrowService;
  private readonly htsService?: IHTSService;
  private readonly resultsWaitMs: number;

  // Per-task collections — Judge can handle multiple bounties sequentially
  private pendingResults: Map<string, ResultMessage[]> = new Map();
  private pendingBids: Map<string, BidMessage[]> = new Map();
  private activeBounties: Map<string, BountyMessage> = new Map();
  private evaluationTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private escrowMap: Map<string, EscrowInfo> = new Map();

  private lastVerdict: VerdictMessage | null = null;
  private errorReason: string | null = null;

  constructor(config: JudgeConfig) {
    this.accountId = config.accountId;
    this.hcs = config.hcsService;
    this.topicIds = config.topicIds;
    this.llmService = config.llmService;
    this.escrowService = config.escrowService;
    this.htsService = config.htsService;
    this.resultsWaitMs = config.resultsWaitMs ?? 30_000;
  }

  getState(): JudgeState {
    return this.state;
  }

  getErrorReason(): string | null {
    return this.errorReason;
  }

  getLastVerdict(): VerdictMessage | null {
    return this.lastVerdict;
  }

  // Inject escrow info from the Requester (wired by the demo orchestrator)
  setEscrowInfo(taskId: string, info: EscrowInfo): void {
    this.escrowMap.set(taskId, info);
    console.log(`[judge:${this.accountId}] Escrow registered for task ${taskId} — schedule: ${info.scheduleId}`);
  }

  // ── State transitions ──

  private transition(to: JudgeState): void {
    console.log(`[judge:${this.accountId}] ${this.state} → ${to}`);
    this.state = to;
  }

  private transitionToError(reason: string): void {
    this.errorReason = reason;
    console.error(`[judge:${this.accountId}] ${this.state} → ERROR: ${reason}`);
    this.state = JudgeState.ERROR;
  }

  reset(): void {
    // Clear all timers before resetting
    for (const timer of this.evaluationTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingResults.clear();
    this.pendingBids.clear();
    this.activeBounties.clear();
    this.evaluationTimers.clear();
    this.escrowMap.clear();
    this.lastVerdict = null;
    this.errorReason = null;
    this.transition(JudgeState.IDLE);
  }

  // ── Main entrypoint ──

  async start(): Promise<void> {
    if (this.state !== JudgeState.IDLE) {
      throw new Error(
        `Cannot start judge in state ${this.state} — call reset() first`,
      );
    }

    this.transition(JudgeState.MONITORING);

    // Subscribe to bounties to capture task descriptions + strategy for LLM context
    await this.hcs.subscribe(this.topicIds.bounties, (message: HCSMessage) => {
      if (message.type === "bounty") {
        this.handleBounty(message);
      }
    });

    // Subscribe to bids to track bid amounts (needed for price-mode evaluation)
    await this.hcs.subscribe(this.topicIds.bids, (message: HCSMessage) => {
      if (message.type === "bid") {
        this.handleBid(message);
      }
    });

    // Subscribe to results — this is the main trigger for evaluation
    await this.hcs.subscribe(this.topicIds.results, (message: HCSMessage) => {
      if (message.type === "result") {
        this.handleResult(message);
      }
    });

    console.log(
      `[judge:${this.accountId}] Monitoring for results (evaluation delay: ${this.resultsWaitMs}ms)...`,
    );
  }

  // ── Bounty handling — track for LLM context ──

  private handleBounty(bounty: BountyMessage): void {
    this.activeBounties.set(bounty.taskId, bounty);
    console.log(
      `[judge:${this.accountId}] Tracking bounty ${bounty.taskId} — "${bounty.description}"`,
    );
  }

  // ── Bid handling — track for price-mode evaluation ──

  private handleBid(bid: BidMessage): void {
    const existing = this.pendingBids.get(bid.taskId) ?? [];
    existing.push(bid);
    this.pendingBids.set(bid.taskId, existing);
    console.log(
      `[judge:${this.accountId}] Tracking bid from ${bid.workerId} for ${bid.taskId} — ${bid.bidAmount} HBAR`,
    );
  }

  // ── Result handling — collect + debounce timer ──

  private handleResult(result: ResultMessage): void {
    if (this.state !== JudgeState.MONITORING) {
      console.log(
        `[judge:${this.accountId}] Ignoring result from ${result.workerId} — state: ${this.state}`,
      );
      return;
    }

    // Collect result for this task
    const existing = this.pendingResults.get(result.taskId) ?? [];
    existing.push(result);
    this.pendingResults.set(result.taskId, existing);

    console.log(
      `[judge:${this.accountId}] Result #${existing.length} received from ${result.workerId} for ${result.taskId} — avg $${result.data.average}`,
    );

    // (Re)start debounce timer for this task — waits resultsWaitMs after the LAST result
    const existingTimer = this.evaluationTimers.get(result.taskId);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.evaluateAndPay(result.taskId).catch((err) => {
        this.transitionToError(err instanceof Error ? err.message : String(err));
      });
    }, this.resultsWaitMs);

    this.evaluationTimers.set(result.taskId, timer);
    console.log(
      `[judge:${this.accountId}] Evaluation timer reset — will evaluate in ${this.resultsWaitMs}ms`,
    );
  }

  // ── Core evaluation pipeline ──

  private async evaluateAndPay(taskId: string): Promise<void> {
    this.evaluationTimers.delete(taskId);

    const results = this.pendingResults.get(taskId);
    if (!results || results.length === 0) {
      console.warn(`[judge:${this.accountId}] No results for task ${taskId} — skipping`);
      return;
    }

    const bounty = this.activeBounties.get(taskId);

    this.transition(JudgeState.EVALUATING);
    console.log(
      `[judge:${this.accountId}] Evaluating ${results.length} result(s) for task ${taskId}...`,
    );

    // Call LLM (or mock) to pick a winner
    const bids = this.pendingBids.get(taskId) ?? [];
    const evaluation = await this.llmService.evaluate(
      taskId,
      bounty?.description ?? "Fetch BTC price from multiple sources",
      results,
      bids,
      bounty?.strategy,
    );

    // Build verdict message
    const verdict: VerdictMessage = {
      type: "verdict",
      taskId,
      winnerId: evaluation.winnerId,
      reason: evaluation.reason,
      paymentAmount: bounty?.reward ?? 100,
    };

    await this.postVerdict(verdict);
    await this.releasePayment(verdict);
  }

  private async postVerdict(verdict: VerdictMessage): Promise<void> {
    this.transition(JudgeState.POSTING_VERDICT);
    await this.hcs.publish(this.topicIds.verdicts, verdict);
    this.lastVerdict = verdict;
    console.log(
      `[judge:${this.accountId}] Verdict posted — winner: ${verdict.winnerId} — "${verdict.reason}"`,
    );
  }

  private async releasePayment(verdict: VerdictMessage): Promise<void> {
    this.transition(JudgeState.RELEASING);

    const escrowInfo = this.escrowMap.get(verdict.taskId);
    if (!escrowInfo) {
      console.warn(
        `[judge:${this.accountId}] No escrow registered for task ${verdict.taskId} — skipping payment release`,
      );
      this.transition(JudgeState.COMPLETED);
      return;
    }

    // 1. HTS token transfer → actual winner (HIVE reward)
    if (this.htsService) {
      const htsTxId = await this.htsService.transferToken(verdict.winnerId, verdict.paymentAmount);
      console.log(
        `[judge:${this.accountId}] HIVE token sent to winner ${verdict.winnerId} — txn: ${htsTxId}`,
      );
    }

    // 2. Sign Hedera Scheduled TX → releases HBAR to escrow recipient (first bidder, fixed at creation)
    const txnId = await this.escrowService.releaseEscrow(escrowInfo);
    console.log(
      `[judge:${this.accountId}] HBAR escrow released — ${escrowInfo.amount} HBAR → ${escrowInfo.recipientAddress} — txn: ${txnId}`,
    );

    this.transition(JudgeState.COMPLETED);
  }

  // ── Shutdown ──

  stop(): void {
    for (const timer of this.evaluationTimers.values()) {
      clearTimeout(timer);
    }
    this.evaluationTimers.clear();
    this.hcs.disconnect();
    console.log(`[judge:${this.accountId}] Stopped`);
  }
}

// ──────────────────────────────────────────────
// CLI entrypoint — run against real Hedera + Anthropic
// ──────────────────────────────────────────────

async function main(): Promise<void> {
  const { createHederaClient, loadTopicIds, loadJudgeConfig } = await import(
    "../config/hedera.js"
  );
  const { HCSService } = await import("../services/hcs.js");
  const { EscrowService: RealEscrowService } = await import("../services/escrow.js");
  const { LLMService: RealLLMService } = await import("../services/llm.js");
  const { PrivateKey } = await import("@hiero-ledger/sdk");

  const client = createHederaClient();
  const topicIds = loadTopicIds();
  const judgeConfig = loadJudgeConfig();
  const resultsWaitMs = process.env.RESULTS_WAIT_MS
    ? parseInt(process.env.RESULTS_WAIT_MS, 10)
    : 30_000;

  const hcsService = new HCSService(client);
  const escrowService = new RealEscrowService(
    client,
    PrivateKey.fromStringDer(judgeConfig.payerPrivateKey),
  );
  const llmService = new RealLLMService(judgeConfig.anthropicApiKey);

  const judge = new JudgeAgent({
    accountId: judgeConfig.accountId,
    hcsService,
    topicIds,
    llmService,
    escrowService,
    resultsWaitMs,
  });

  process.on("SIGINT", () => {
    console.log("\nShutting down judge...");
    judge.stop();
    process.exit(0);
  });

  await judge.start();
  console.log(`[judge] Running against Hedera testnet — waiting for results...`);
}

// Run if executed directly
const isDirectRun =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isDirectRun) {
  main().catch((err) => {
    console.error("Judge failed:", err);
    process.exit(1);
  });
}
