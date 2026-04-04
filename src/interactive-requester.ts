import readline from "node:readline";
import express from "express";
import type { BountyStrategy, BountyCategory } from "./types/index.js";
import { RequesterAgent, type RequesterConfig } from "./agents/requester.js";
import { RequesterState } from "./types/index.js";

// ──────────────────────────────────────────────
// Interactive Requester — CLI + HTTP API
// ──────────────────────────────────────────────

interface BountyRequest {
  description: string;
  strategy?: BountyStrategy;
  category?: BountyCategory;
  reward?: number;
  maxBids?: number;
  deadlineMinutes?: number;
}

interface TaskRecord {
  taskId: string;
  params: BountyRequest;
  state: string;
  createdAt: string;
}

export class InteractiveRequester {
  private readonly requester: RequesterAgent;
  private readonly defaultReward: number;
  private readonly defaultMaxBids: number;
  private readonly tasks: Map<string, TaskRecord> = new Map();
  private rl: readline.Interface | null = null;
  private app: express.Express | null = null;
  private server: ReturnType<typeof express.prototype.listen> | null = null;

  constructor(
    requesterConfig: RequesterConfig,
    options?: { defaultReward?: number; defaultMaxBids?: number },
  ) {
    this.requester = new RequesterAgent(requesterConfig);
    this.defaultReward = options?.defaultReward ?? 100;
    this.defaultMaxBids = options?.defaultMaxBids ?? 2;
  }

  getRequester(): RequesterAgent {
    return this.requester;
  }

  // ── Submit a bounty programmatically ──

  async submitRequest(req: BountyRequest): Promise<string> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const reward = req.reward ?? this.defaultReward;
    const deadlineMinutes = req.deadlineMinutes ?? 5;

    const record: TaskRecord = {
      taskId,
      params: req,
      state: "submitted",
      createdAt: new Date().toISOString(),
    };
    this.tasks.set(taskId, record);

    await this.requester.submitBounty({
      taskId,
      description: req.description,
      reward,
      deadline: new Date(Date.now() + deadlineMinutes * 60_000).toISOString(),
      strategy: req.strategy ?? "quality",
      category: req.category ?? "general",
    });

    record.state = "awaiting_bids";
    console.log(`\n✓ Bounty posted: ${taskId} (${req.strategy ?? "quality"} mode, ${reward} HBAR)`);
    return taskId;
  }

  // ── HTTP API ──

  startApi(port = 3100): void {
    this.app = express();
    this.app.use(express.json());

    this.app.post("/api/request", async (req: express.Request, res: express.Response) => {
      try {
        const body = req.body as BountyRequest;
        if (!body.description) {
          res.status(400).json({ error: "description is required" });
          return;
        }
        const taskId = await this.submitRequest(body);
        res.json({ taskId, status: "submitted" });
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    this.app.get("/api/status/:taskId", (req: express.Request, res: express.Response) => {
      const record = this.tasks.get(req.params.taskId as string);
      if (!record) {
        res.status(404).json({ error: "task not found" });
        return;
      }
      // Update state from requester agent
      record.state = this.requester.getState();
      res.json(record);
    });

    this.app.get("/api/tasks", (_req: express.Request, res: express.Response) => {
      res.json([...this.tasks.values()]);
    });

    this.server = this.app.listen(port, () => {
      console.log(`[api] HTTP API listening on http://localhost:${port}`);
      console.log(`  POST /api/request  — { description, strategy?, category?, reward?, maxBids?, deadlineMinutes? }`);
      console.log(`  GET  /api/status/:taskId`);
      console.log(`  GET  /api/tasks`);
    });
  }

  // ── Interactive CLI ──

  startCli(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║         HIVERA — Interactive Requester       ║");
    console.log("╠══════════════════════════════════════════════╣");
    console.log("║  Type 'new' to create a request             ║");
    console.log("║  Type 'status' to check current state       ║");
    console.log("║  Type 'tasks' to list all tasks             ║");
    console.log("║  Type 'help' for examples                   ║");
    console.log("║  Type 'quit' to exit                        ║");
    console.log("╚══════════════════════════════════════════════╝\n");

    this.prompt();
  }

  private prompt(): void {
    this.rl?.question("hivera> ", (input) => {
      const cmd = input.trim().toLowerCase();
      if (cmd === "quit" || cmd === "exit") {
        this.stop();
        return;
      }
      this.handleCommand(cmd).then(() => this.prompt());
    });
  }

  private async handleCommand(cmd: string): Promise<void> {
    switch (cmd) {
      case "new":
      case "request":
        await this.interactiveNewRequest();
        break;
      case "status":
        console.log(`  State: ${this.requester.getState()}`);
        console.log(`  Active tasks: ${this.tasks.size}`);
        break;
      case "tasks":
        if (this.tasks.size === 0) {
          console.log("  No tasks yet.");
        } else {
          for (const t of this.tasks.values()) {
            console.log(`  ${t.taskId} — ${t.params.strategy ?? "quality"} — ${t.state} — "${t.params.description.slice(0, 50)}"`);
          }
        }
        break;
      case "help":
        this.printExamples();
        break;
      case "":
        break;
      default:
        console.log(`  Unknown command: ${cmd}. Type 'help' for options.`);
    }
  }

  private async interactiveNewRequest(): Promise<void> {
    const ask = (q: string): Promise<string> =>
      new Promise((resolve) => this.rl?.question(q, resolve));

    const description = await ask("  Description: ");
    if (!description.trim()) {
      console.log("  ✗ Description cannot be empty.");
      return;
    }

    const strategyInput = await ask("  Strategy (price/quality) [quality]: ");
    const strategy: BountyStrategy =
      strategyInput.trim().toLowerCase() === "price" ? "price" : "quality";

    const categoryInput = await ask("  Category (crypto-price/travel/delivery/general) [general]: ");
    const category: BountyCategory = categoryInput.trim() || "general";

    const rewardInput = await ask(`  Reward in HBAR [${this.defaultReward}]: `);
    const reward = rewardInput.trim() ? parseInt(rewardInput, 10) : this.defaultReward;

    const deadlineInput = await ask("  Deadline in minutes [5]: ");
    const deadlineMinutes = deadlineInput.trim() ? parseInt(deadlineInput, 10) : 5;

    await this.submitRequest({
      description: description.trim(),
      strategy,
      category,
      reward,
      deadlineMinutes,
    });
  }

  private printExamples(): void {
    console.log("\n  Example requests you can submit:");
    console.log("  ────────────────────────────────");
    console.log('  • "Fetch BTC/USD price from 3 sources" (crypto-price, quality)');
    console.log('  • "Find best Paris→Tokyo flights for July 2026" (travel, price)');
    console.log('  • "Compare B2B delivery rates Paris→Berlin, 500kg pallet" (delivery, price)');
    console.log('  • "Get ETH gas price estimates from multiple providers" (crypto-price, quality)');
    console.log('  • "Find cheapest car rental Nice airport, 3 days" (travel, price)\n');
  }

  // ── Shutdown ──

  stop(): void {
    this.rl?.close();
    this.server?.close();
    this.requester.stop();
    console.log("\n[interactive] Stopped.");
    process.exit(0);
  }
}

// ──────────────────────────────────────────────
// CLI entrypoint — run against real Hedera
// ──────────────────────────────────────────────

async function main(): Promise<void> {
  const { createHederaClient, loadTopicIds, loadRequesterConfig } = await import(
    "./config/hedera.js"
  );
  const { HCSService } = await import("./services/hcs.js");
  const { EscrowService: RealEscrowService } = await import("./services/escrow.js");
  const { PrivateKey } = await import("@hiero-ledger/sdk");

  const client = createHederaClient();
  const topicIds = loadTopicIds();
  const requesterConfig = loadRequesterConfig();

  const hcsService = new HCSService(client);
  const escrowService = new RealEscrowService(
    client,
    PrivateKey.fromStringDer(requesterConfig.privateKey),
  );

  const apiPort = process.env.REQUESTER_API_PORT
    ? parseInt(process.env.REQUESTER_API_PORT, 10)
    : 3100;

  const interactive = new InteractiveRequester(
    {
      accountId: requesterConfig.accountId,
      hcsService,
      topicIds,
      escrowService,
      maxBidsToAccept: 2,
    },
    { defaultReward: 100, defaultMaxBids: 2 },
  );

  process.on("SIGINT", () => interactive.stop());

  interactive.startApi(apiPort);
  interactive.startCli();
}

// Run if executed directly
const isDirectRun =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isDirectRun) {
  main().catch((err) => {
    console.error("Interactive requester failed:", err);
    process.exit(1);
  });
}
