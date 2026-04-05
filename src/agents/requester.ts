import type {
  IHCSService,
  TopicIds,
  BountyMessage,
  BidMessage,
  ResultMessage,
  VerdictMessage,
  EscrowMessage,
  EvidenceMessage,
  HCSMessage,
} from "../types/index.js";
import { RequesterState } from "../types/index.js";
import { EscrowService, MockEscrowService, type EscrowInfo } from "../services/escrow.js";
import { PrivateKey } from "@hiero-ledger/sdk";

// ──────────────────────────────────────────────
// Requester Agent — State Machine
// ──────────────────────────────────────────────

export interface RequesterConfig {
  accountId: string;
  privateKey: PrivateKey;
  hcsService: IHCSService;
  topicIds: TopicIds;
  escrowService: EscrowService | MockEscrowService;
  maxBidsToAccept?: number; // default 2 — can be overridden per bounty via BountyMessage.maxWorkers
  bidTimeoutMs?: number;    // default 60_000 — how long to wait for bids before proceeding with available workers
  onEscrowCreated?: (info: EscrowInfo) => void; // called after escrow is locked — use to wire Judge
}

export class RequesterAgent {
  private state: RequesterState = RequesterState.IDLE;
  private readonly accountId: string;
  private readonly privateKey: PrivateKey;
  private readonly hcs: IHCSService;
  private readonly topicIds: TopicIds;
  private readonly escrowService: EscrowService | MockEscrowService;
  private readonly maxBidsToAccept: number;
  private readonly bidTimeoutMs: number;
  private readonly onEscrowCreated?: (info: EscrowInfo) => void;

  private currentBounty: BountyMessage | null = null;
  private effectiveMaxBids: number; // maxBidsToAccept overridden per-bounty by BountyMessage.maxWorkers
  private acceptedBids: BidMessage[] = [];
  private results: ResultMessage[] = [];
  private lastVerdict: VerdictMessage | null = null;
  private lastEvidence: EvidenceMessage | null = null;
  private escrowInfo: EscrowInfo | null = null;
  private errorReason: string | null = null;
  private isEscrowing = false; // guard against double-call from concurrent bid handlers
  private bidTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: RequesterConfig) {
    this.accountId = config.accountId;
    this.privateKey = config.privateKey;
    this.hcs = config.hcsService;
    this.topicIds = config.topicIds;
    this.escrowService = config.escrowService;
    this.maxBidsToAccept = config.maxBidsToAccept ?? 2;
    this.bidTimeoutMs = config.bidTimeoutMs ?? 60_000;
    this.effectiveMaxBids = this.maxBidsToAccept;
    this.onEscrowCreated = config.onEscrowCreated;
  }

  getState(): RequesterState {
    return this.state;
  }

  getErrorReason(): string | null {
    return this.errorReason;
  }

  getAcceptedBids(): BidMessage[] {
    return [...this.acceptedBids];
  }

  getEscrowInfo(): EscrowInfo | null {
    return this.escrowInfo;
  }

  getLastVerdict(): VerdictMessage | null {
    return this.lastVerdict;
  }

  getLastEvidence(): EvidenceMessage | null {
    return this.lastEvidence;
  }

  getResults(): ResultMessage[] {
    return [...this.results];
  }

  // ── State transitions ──

  private transition(to: RequesterState): void {
    console.log(`[requester:${this.accountId}] ${this.state} → ${to}`);
    this.state = to;
  }

  private transitionToError(reason: string): void {
    this.errorReason = reason;
    console.error(`[requester:${this.accountId}] ${this.state} → ERROR: ${reason}`);
    this.state = RequesterState.ERROR;
  }

  reset(): void {
    if (this.bidTimeoutTimer !== null) {
      clearTimeout(this.bidTimeoutTimer);
      this.bidTimeoutTimer = null;
    }
    this.currentBounty = null;
    this.effectiveMaxBids = this.maxBidsToAccept;
    this.acceptedBids = [];
    this.results = [];
    this.lastVerdict = null;
    this.lastEvidence = null;
    this.escrowInfo = null;
    this.errorReason = null;
    this.isEscrowing = false;
    this.transition(RequesterState.IDLE);
  }

  // ── Main entrypoint ──

  async start(
    bountyParams: Omit<BountyMessage, "type" | "requesterAddress">,
  ): Promise<void> {
    if (this.state !== RequesterState.IDLE) {
      throw new Error(
        `Cannot start requester in state ${this.state} — call reset() first`,
      );
    }

    // Subscribe to bids and verdicts before posting the bounty
    await this.hcs.subscribe(this.topicIds.bids, (message: HCSMessage) => {
      if (message.type === "bid") {
        this.handleBid(message);
      }
    });

    await this.hcs.subscribe(this.topicIds.verdicts, (message: HCSMessage) => {
      if (message.type === "verdict") {
        this.handleVerdict(message);
      } else if (message.type === "evidence") {
        this.handleEvidence(message);
      }
    });

    await this.hcs.subscribe(this.topicIds.results, (message: HCSMessage) => {
      if (message.type === "result") {
        this.handleResult(message);
      }
    });

    // Build full bounty message and post it
    const bounty: BountyMessage = {
      type: "bounty",
      requesterAddress: this.accountId,
      ...bountyParams,
    };
    this.currentBounty = bounty;

    // Override maxBids per-bounty if specified
    this.effectiveMaxBids = bounty.maxWorkers ?? this.maxBidsToAccept;

    this.transition(RequesterState.POSTING);
    await this.hcs.publish(this.topicIds.bounties, bounty);

    console.log(
      `[requester:${this.accountId}] Bounty posted: ${bounty.taskId} — reward: ${bounty.reward} HBAR`,
    );
    this.transition(RequesterState.AWAITING_BIDS);
    console.log(
      `[requester:${this.accountId}] Waiting for bids (max: ${this.effectiveMaxBids}, timeout: ${this.bidTimeoutMs}ms)...`,
    );

    // Start bid timeout — proceed with available workers if not enough bid in time
    this.bidTimeoutTimer = setTimeout(() => {
      this.bidTimeoutTimer = null;
      this.handleBidTimeout();
    }, this.bidTimeoutMs);
  }

  // ── Bid handling ──

  private handleBid(bid: BidMessage): void {
    // Guard: only accept bids when in the right state
    if (this.state !== RequesterState.AWAITING_BIDS) {
      console.log(
        `[requester:${this.accountId}] Ignoring late bid from ${bid.workerId} — state: ${this.state}`,
      );
      return;
    }

    // Guard: ignore bids for a different task
    if (!this.currentBounty || bid.taskId !== this.currentBounty.taskId) {
      return;
    }

    // Guard: already have enough bids — isEscrowing prevents race conditions
    if (this.acceptedBids.length >= this.effectiveMaxBids || this.isEscrowing) {
      console.log(
        `[requester:${this.accountId}] Ignoring excess bid from ${bid.workerId} — already have ${this.acceptedBids.length}/${this.effectiveMaxBids}`,
      );
      return;
    }

    this.acceptedBids.push(bid);
    console.log(
      `[requester:${this.accountId}] Accepted bid ${this.acceptedBids.length}/${this.effectiveMaxBids} from ${bid.workerId} — ${bid.bidAmount} HBAR`,
    );

    if (this.acceptedBids.length >= this.effectiveMaxBids) {
      // Got all the workers we wanted — cancel timeout and lock escrow immediately
      if (this.bidTimeoutTimer !== null) {
        clearTimeout(this.bidTimeoutTimer);
        this.bidTimeoutTimer = null;
      }
      this.isEscrowing = true;
      this.lockEscrow().catch((err) => {
        this.transitionToError(err instanceof Error ? err.message : String(err));
      });
    }
  }

  private handleBidTimeout(): void {
    if (this.state !== RequesterState.AWAITING_BIDS) return;

    if (this.acceptedBids.length >= 1) {
      console.log(
        `[requester:${this.accountId}] Bid timeout — proceeding with ${this.acceptedBids.length}/${this.effectiveMaxBids} worker(s)`,
      );
      this.isEscrowing = true;
      this.lockEscrow().catch((err) => {
        this.transitionToError(err instanceof Error ? err.message : String(err));
      });
    } else {
      this.transitionToError("Bid timeout: no workers responded");
    }
  }

  private async lockEscrow(): Promise<void> {
    if (!this.currentBounty) return;

    this.transition(RequesterState.ESCROWING);
    console.log(
      `[requester:${this.accountId}] Creating escrow for ${this.currentBounty.reward} HBAR — task ${this.currentBounty.taskId}`,
    );

    // Deposit HBAR to the escrow account. The Judge will later release
    // from the escrow account to the actual winner (determined at verdict time).
    this.escrowInfo = await this.escrowService.createEscrow(
      this.currentBounty.taskId,
      this.accountId,
      this.currentBounty.reward,
      this.privateKey,
    );

    // Notify Judge (or external handler) that escrow is ready
    if (this.onEscrowCreated) {
      this.onEscrowCreated(this.escrowInfo);
    }

    // Publish escrow info on HCS so the Judge can pick it up when running as a
    // separate process (no shared memory). Judge subscribes to the bounties topic
    // and will call setEscrowInfo() when it receives this message.
    const escrowMsg: EscrowMessage = {
      type: "escrow",
      taskId: this.escrowInfo.taskId,
      escrowAccountId: this.escrowInfo.escrowAccountId,
      amount: this.escrowInfo.amount,
    };
    await this.hcs.publish(this.topicIds.bounties, escrowMsg);

    this.transition(RequesterState.AWAITING_RESULTS);
    console.log(
      `[requester:${this.accountId}] Escrow locked — account: ${this.escrowInfo.escrowAccountId}, amount: ${this.escrowInfo.amount} HBAR`,
    );
  }

  // ── Verdict & Evidence handling (informational) ──

  private handleResult(result: ResultMessage): void {
    if (!this.currentBounty || result.taskId !== this.currentBounty.taskId) {
      return;
    }
    this.results.push(result);
    console.log(`[requester:${this.accountId}] Result received from ${result.workerId} for ${result.taskId}`);
  }

  private handleVerdict(verdict: VerdictMessage): void {
    if (!this.currentBounty || verdict.taskId !== this.currentBounty.taskId) {
      return;
    }

    this.lastVerdict = verdict;
    console.log(
      `[requester:${this.accountId}] Verdict received — winner: ${verdict.winnerId}, payment: ${verdict.paymentAmount} HBAR — "${verdict.reason}"`,
    );
    this.transition(RequesterState.COMPLETED);
  }

  private handleEvidence(evidence: EvidenceMessage): void {
    if (!this.currentBounty || evidence.taskId !== this.currentBounty.taskId) {
      return;
    }
    this.lastEvidence = evidence;
    console.log(`[requester:${this.accountId}] Evidence (payment txn) received: ${evidence.transactionId}`);
  }

  // ── Convenience: submit a new bounty (resets state if needed) ──

  async submitBounty(
    bountyParams: Omit<BountyMessage, "type" | "requesterAddress">,
  ): Promise<void> {
    if (this.state !== RequesterState.IDLE) {
      this.reset();
    }
    await this.start(bountyParams);
  }

  // ── Shutdown ──

  stop(): void {
    if (this.bidTimeoutTimer !== null) {
      clearTimeout(this.bidTimeoutTimer);
      this.bidTimeoutTimer = null;
    }
    this.hcs.disconnect();
    console.log(`[requester:${this.accountId}] Stopped`);
  }
}

// ──────────────────────────────────────────────
// CLI entrypoint — run against real Hedera
// ──────────────────────────────────────────────

async function main(): Promise<void> {
  const { createHederaClient, loadTopicIds, loadRequesterConfig, loadEscrowConfig } = await import(
    "../config/hedera.js"
  );
  const { HCSService } = await import("../services/hcs.js");
  const { EscrowService: RealEscrowService } = await import("../services/escrow.js");
  const { PrivateKey } = await import("@hiero-ledger/sdk");

  const client = createHederaClient();
  const topicIds = loadTopicIds();
  const requesterConfig = loadRequesterConfig();
  const escrowConfig = loadEscrowConfig();

  const hcsService = new HCSService(client);
  const escrowService = new RealEscrowService(
    client,
    escrowConfig.escrowAccountId,
    PrivateKey.fromStringDer(escrowConfig.escrowPrivateKey),
  );

  const requester = new RequesterAgent({
    accountId: requesterConfig.accountId,
    privateKey: PrivateKey.fromStringDer(requesterConfig.privateKey),
    hcsService,
    topicIds,
    escrowService,
    maxBidsToAccept: 2,
    bidTimeoutMs: requesterConfig.bidTimeoutMs,
  });

  process.on("SIGINT", () => {
    console.log("\nShutting down requester...");
    requester.stop();
    process.exit(0);
  });

  const description =
    process.env.BOUNTY_DESCRIPTION ??
    process.argv[2] ??
    "Complete the assigned task and return structured results";
  const taskIdPrefix = process.env.BOUNTY_TASK_PREFIX ?? "task";
  const reward = process.env.BOUNTY_REWARD ? parseInt(process.env.BOUNTY_REWARD, 10) : 100;
  const strategy = (process.env.BOUNTY_STRATEGY as import("../types/index.js").BountyStrategy) ?? "quality";
  const category = process.env.BOUNTY_CATEGORY ?? "general";

  await requester.start({
    taskId: `${taskIdPrefix}-${Date.now()}`,
    description,
    reward,
    deadline: new Date(Date.now() + 300_000).toISOString(), // 5 minutes
    strategy,
    category,
  });

  console.log(`[requester] Running — waiting for bids...`);
}

// Run if executed directly
import { fileURLToPath } from "url";
const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  main().catch((err) => {
    console.error("Requester failed:", err);
    process.exit(1);
  });
}
