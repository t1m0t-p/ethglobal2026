import type {
  IHCSService,
  TopicIds,
  BountyMessage,
  BidMessage,
  ResultMessage,
  VerdictMessage,
  EscrowMessage,
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
  // Consolation prize paid (in HIVE tokens) to each losing worker that submitted a result.
  // Ensures agents that burned API credits on losing bids are not left out-of-pocket.
  // Defaults: 10% of the bounty reward, rounded up, with a floor of 1.
  consolationPrize?: number;
}

export class JudgeAgent {
  private topLevelState: JudgeState = JudgeState.IDLE;
  private readonly accountId: string;
  private readonly hcs: IHCSService;
  private readonly topicIds: TopicIds;
  private readonly llmService: LLMService | MockLLMService;
  private readonly escrowService: EscrowService | MockEscrowService;
  private readonly htsService?: IHTSService;
  private readonly resultsWaitMs: number;
  private readonly explicitConsolationPrize?: number;

  // Per-task collections — Judge can handle multiple bounties concurrently
  private taskStates: Map<string, JudgeState> = new Map();
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
    this.explicitConsolationPrize = config.consolationPrize;
  }

  getState(): JudgeState {
    return this.topLevelState;
  }

  getErrorReason(): string | null {
    return this.errorReason;
  }

  getLastVerdict(): VerdictMessage | null {
    return this.lastVerdict;
  }

  // Per-task state accessor — use this in tests instead of getState() (which returns
  // the agent-level state and stays MONITORING for the lifetime of the judge).
  getTaskState(taskId: string): JudgeState {
    return this.taskStates.get(taskId) ?? JudgeState.IDLE;
  }

  // Inject escrow info from the Requester (wired by the demo orchestrator or callback)
  setEscrowInfo(taskId: string, info: EscrowInfo): void {
    this.escrowMap.set(taskId, info);
    console.log(`[judge:${this.accountId}] Escrow registered for task ${taskId} — account: ${info.escrowAccountId}`);
  }

  // ── State transitions ──

  private transition(to: JudgeState): void {
    console.log(`[judge:${this.accountId}] ${this.topLevelState} → ${to}`);
    this.topLevelState = to;
  }

  private transitionTask(taskId: string, to: JudgeState): void {
    const from = this.taskStates.get(taskId) ?? JudgeState.IDLE;
    console.log(`[judge:${this.accountId}] Task ${taskId}: ${from} → ${to}`);
    this.taskStates.set(taskId, to);
  }

  private transitionToError(reason: string): void {
    this.errorReason = reason;
    console.error(`[judge:${this.accountId}] ${this.topLevelState} → ERROR: ${reason}`);
    this.topLevelState = JudgeState.ERROR;
  }

  reset(): void {
    // Clear all timers before resetting
    for (const timer of this.evaluationTimers.values()) {
      clearTimeout(timer);
    }
    this.taskStates.clear();
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
    if (this.topLevelState !== JudgeState.IDLE) {
      throw new Error(
        `Cannot start judge in state ${this.topLevelState} — call reset() first`,
      );
    }

    this.transition(JudgeState.MONITORING);

    // Subscribe to bounties to capture task descriptions + strategy for LLM context,
    // and to EscrowMessages published by the Requester after locking HBAR.
    await this.hcs.subscribe(this.topicIds.bounties, (message: HCSMessage) => {
      if (message.type === "bounty") {
        this.handleBounty(message);
      } else if (message.type === "escrow") {
        this.handleEscrowMessage(message);
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

  // ── Escrow message handling — auto-wiring across processes ──

  private handleEscrowMessage(msg: EscrowMessage): void {
    this.setEscrowInfo(msg.taskId, {
      escrowAccountId: msg.escrowAccountId,
      taskId: msg.taskId,
      amount: msg.amount,
    });
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
    if (this.topLevelState !== JudgeState.MONITORING) {
      console.log(
        `[judge:${this.accountId}] Ignoring result from ${result.workerId} — state: ${this.topLevelState}`,
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
      `[judge:${this.accountId}] Evaluation timer reset for task ${result.taskId} — will evaluate in ${this.resultsWaitMs}ms`,
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

    this.transitionTask(taskId, JudgeState.EVALUATING);
    console.log(
      `[judge:${this.accountId}] Evaluating ${results.length} result(s) for task ${taskId}...`,
    );

    // Call LLM (or mock) to pick a winner
    const bids = this.pendingBids.get(taskId) ?? [];
    const evaluation = await this.llmService.evaluate(
      taskId,
      bounty?.description ?? "Complete the assigned task and return results",
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

    await this.postVerdict(verdict, taskId);
    await this.releasePayment(verdict, taskId);
  }

  private async postVerdict(verdict: VerdictMessage, taskId: string): Promise<void> {
    this.transitionTask(taskId, JudgeState.POSTING_VERDICT);
    await this.hcs.publish(this.topicIds.verdicts, verdict);
    this.lastVerdict = verdict;
    console.log(
      `[judge:${this.accountId}] Verdict posted for task ${verdict.taskId} — winner: ${verdict.winnerId} — "${verdict.reason}"`,
    );
  }

  private async releasePayment(verdict: VerdictMessage, taskId: string): Promise<void> {
    this.transitionTask(taskId, JudgeState.RELEASING);

    const escrowInfo = this.escrowMap.get(verdict.taskId);
    if (!escrowInfo) {
      console.warn(
        `[judge:${this.accountId}] No escrow registered for task ${verdict.taskId} — skipping payment release`,
      );
      this.transitionTask(taskId, JudgeState.COMPLETED);
      return;
    }

    // 1. HTS token transfer → actual winner (HIVE reward)
    if (this.htsService) {
      try {
        const htsTxId = await this.htsService.transferToken(verdict.winnerId, verdict.paymentAmount);
        console.log(
          `[judge:${this.accountId}] HIVE token sent to winner ${verdict.winnerId} — txn: ${htsTxId}`,
        );
        await this.hcs.publish(this.topicIds.verdicts, {
          type: "evidence",
          taskId: verdict.taskId,
          transactionId: htsTxId,
          kind: "hts-reward",
          recipient: verdict.winnerId,
          amount: verdict.paymentAmount,
          note: "HIVE reward to winning worker",
        });
      } catch (err) {
        console.error(
          `[judge:${this.accountId}] HIVE token transfer to winner failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 2. Release HBAR from escrow account → actual winner
    // The winner is now determined, so we transfer from the escrow account to the correct winner
    const txnId = await this.escrowService.releaseEscrow(escrowInfo, verdict.winnerId);
    console.log(
      `[judge:${this.accountId}] HBAR escrow released — ${escrowInfo.amount} HBAR → ${verdict.winnerId} (task ${verdict.taskId}) — txn: ${txnId}`,
    );

    // 3. Publish evidence message for the UI to show Hashscan link
    await this.hcs.publish(this.topicIds.verdicts, {
      type: "evidence",
      taskId: verdict.taskId,
      transactionId: txnId,
      kind: "escrow-release",
      recipient: verdict.winnerId,
      amount: escrowInfo.amount,
      note: "HBAR escrow released to winner",
    });

    // 4. Pay consolation prizes to losing workers that actually submitted a result.
    // This ensures agent operators don't burn API credits for nothing — especially
    // in quality mode where only the best submission wins.
    await this.payConsolations(verdict, taskId);

    this.transitionTask(taskId, JudgeState.COMPLETED);
  }

  private async payConsolations(verdict: VerdictMessage, taskId: string): Promise<void> {
    if (!this.htsService) {
      return; // no HTS → can't pay consolations
    }

    const results = this.pendingResults.get(verdict.taskId) ?? [];
    const losers = Array.from(
      new Set(
        results
          .filter((r) => r.workerId !== verdict.winnerId)
          .map((r) => r.workerId),
      ),
    );

    if (losers.length === 0) {
      return;
    }

    const consolationAmount = this.computeConsolationAmount(verdict.paymentAmount);
    console.log(
      `[judge:${this.accountId}] Paying ${consolationAmount} HIVE consolation to ${losers.length} losing worker(s) for task ${taskId}`,
    );

    for (const loserId of losers) {
      try {
        const txId = await this.htsService.transferToken(loserId, consolationAmount);
        console.log(
          `[judge:${this.accountId}] Consolation sent → ${loserId} (${consolationAmount} HIVE) — txn: ${txId}`,
        );
        await this.hcs.publish(this.topicIds.verdicts, {
          type: "evidence",
          taskId: verdict.taskId,
          transactionId: txId,
          kind: "consolation",
          recipient: loserId,
          amount: consolationAmount,
          note: "Consolation prize for submitted losing result",
        });
      } catch (err) {
        console.error(
          `[judge:${this.accountId}] Consolation payout to ${loserId} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private computeConsolationAmount(reward: number): number {
    if (this.explicitConsolationPrize !== undefined) {
      return Math.max(0, Math.floor(this.explicitConsolationPrize));
    }
    // Default: 10% of reward, rounded up, with a floor of 1.
    return Math.max(1, Math.ceil(reward * 0.1));
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
  const { createHederaClient, loadTopicIds, loadJudgeConfig, loadEscrowConfig } = await import(
    "../config/hedera.js"
  );
  const { HCSService } = await import("../services/hcs.js");
  const { EscrowService: RealEscrowService } = await import("../services/escrow.js");
  const { LLMService: RealLLMService, MockLLMService } = await import("../services/llm.js");
  const { HTSService } = await import("../services/hts.js");
  const { PrivateKey } = await import("@hiero-ledger/sdk");

  const client = createHederaClient();
  const topicIds = loadTopicIds();
  const judgeConfig = loadJudgeConfig();
  const escrowConfig = loadEscrowConfig();
  const resultsWaitMs = process.env.RESULTS_WAIT_MS
    ? parseInt(process.env.RESULTS_WAIT_MS, 10)
    : 30_000;
  const llmProvider = process.env.LLM_PROVIDER ?? "hardcoded";

  const hcsService = new HCSService(client);
  const escrowService = new RealEscrowService(
    client,
    escrowConfig.escrowAccountId,
    PrivateKey.fromStringDer(escrowConfig.escrowPrivateKey),
  );

  let llmService: LLMService | MockLLMService;
  if (llmProvider === "claude") {
    if (!judgeConfig.anthropicApiKey) {
      throw new Error("LLM_PROVIDER=claude requires ANTHROPIC_API_KEY to be set");
    }
    const model = process.env.ANTHROPIC_MODEL || undefined;
    llmService = new RealLLMService(judgeConfig.anthropicApiKey, model);
    console.log(`[judge] Using Claude LLM evaluation (model: ${model ?? "default"})`);
  } else {
    console.log("[judge] Using deterministic evaluation (LLM_PROVIDER=hardcoded)");
    llmService = new MockLLMService();
  }

  // Wire HTSService so the Judge can reward the winner + consolation prizes to losers.
  // The Judge account must be the token treasury (or hold sufficient balance).
  const htsService = new HTSService(
    client,
    judgeConfig.tokenId,
    judgeConfig.accountId,
    judgeConfig.payerPrivateKey,
  );

  const consolationPrize = process.env.CONSOLATION_PRIZE
    ? parseInt(process.env.CONSOLATION_PRIZE, 10)
    : undefined;

  const judge = new JudgeAgent({
    accountId: judgeConfig.accountId,
    hcsService,
    topicIds,
    llmService,
    escrowService,
    htsService,
    resultsWaitMs,
    consolationPrize,
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
import { fileURLToPath } from "url";
const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  main().catch((err) => {
    console.error("Judge failed:", err);
    process.exit(1);
  });
}
