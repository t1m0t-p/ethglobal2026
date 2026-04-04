# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hivera** — a multi-agent autonomous labor market on Hedera, built for ETHGlobal Cannes 2026. Agents (Requester, Worker×2, Judge) negotiate and execute tasks entirely on Hedera's infrastructure.

Target prizes: Hedera AI & Agentic Payments ($6k) + ENS stretch ($5k).

## Commands

```bash
npm run build           # TypeScript type-check only (tsc --noEmit, no emit)
npm run x402-server     # Start mock x402 payment server on port 4020
npm run topics:create   # Create HCS topics on testnet (run once, share IDs)

# Worker
npm run worker:mock     # Worker E2E test — no Hedera, no external deps
npm run worker          # Worker against real Hedera testnet

# Requester
npm run requester:mock  # Requester E2E test — no Hedera
npm run requester       # Requester against real Hedera testnet

# Judge
npm run judge:mock      # Judge E2E test — no Hedera, no Anthropic key
npm run judge           # Judge against real Hedera testnet + Claude API
```

> No test runner is configured. `tsx` runs TypeScript directly. Each `*:mock` script is a self-contained E2E test with assertions that exits 0 on success.

## Architecture

### Agent Roles

| Agent | File | Responsibility |
|---|---|---|
| Requester | `src/agents/requester.ts` | Posts bounties on HCS, collects bids (up to `maxBidsToAccept`), locks HBAR in escrow via Hedera Scheduled Transaction |
| Worker | `src/agents/worker.ts` | Discovers bounties on HCS, bids, fetches BTC price via x402, posts result |
| Judge | `src/agents/judge.ts` | Monitors results, calls Claude to pick winner, posts verdict, signs escrow to release HBAR |

### Full Task Lifecycle

```
Requester → [HCS: bounties] → Workers discover
Workers   → [HCS: bids]     → Requester collects N bids → creates Hedera Scheduled TX (escrow)
Workers   → [HCS: results]  → Judge collects, debounces resultsWaitMs, calls Claude
Judge     → [HCS: verdicts] → posts winner; signs Scheduled TX → HBAR released on-chain
```

**Critical gap:** The Worker does NOT wait for bid acceptance before executing the task. It bids and immediately fetches the price. All workers that bid will submit results; the Judge picks the winner among submitted results.

### Services Layer (`src/services/`)

- **`hcs.ts`** — `HCSService` (real Hedera) and `MockHCSService` (in-memory). Both implement `IHCSService`. Use `MockHCSService.simulateMessage()` to inject test messages; `getPublished()` for assertions.
- **`escrow.ts`** — `EscrowService` wraps Hedera `ScheduleCreateTransaction` (locks HBAR without executing) and `ScheduleSignTransaction` (releases on Judge signature). `MockEscrowService` is in-memory with `isReleased()` for assertions.
- **`llm.ts`** — `LLMService` calls Claude (`claude-haiku-4-5-20251001`) with structured JSON output to pick a winner. Falls back to `MockLLMService` on parse error. `MockLLMService` uses a deterministic algorithm: most sources wins, then lowest price variance.
- **`x402-client.ts`** — `fetchWithPayment()` implements the x402 protocol: initial request → 402 → parse `X-Payment-Required` header → sign → retry with `X-Payment` header. Headers are base64-encoded JSON.
- **`price-fetcher.ts`** — Fetches BTC price from CoinGecko, Kraken, and Binance in parallel. Requires ≥2 successful sources.

### x402 Mock Server (`src/x402-mock-server/server.ts`)

Express server simulating x402. `GET /api/v1/btc-price` returns HTTP 402 on first call, validates `X-Payment` header on retry. Falls back to hardcoded price if external APIs fail. Worker mock uses port 4021, CLI uses port 4020 (set via `X402_SERVER_URL`).

### Dependency Injection Pattern

All agents (`WorkerAgent`, `RequesterAgent`, `JudgeAgent`) accept injected services in their constructor, making them fully testable without Hedera. The CLI entrypoint in each file wires real services. The `*-mock.ts` files wire mock services and run self-contained E2E assertions.

The Judge receives escrow info from the Requester via `judge.setEscrowInfo(taskId, info)` — this wiring is currently done manually in the demo orchestrator, not automatically.

### Types (`src/types/index.ts`)

HCS message contracts: `BountyMessage`, `BidMessage`, `ResultMessage`, `VerdictMessage`. State machine enums: `WorkerState`, `RequesterState`, `JudgeState`. `IHCSService` is the interface both real and mock services implement.

### Config (`src/config/hedera.ts`)

`createHederaClient()`, `loadTopicIds()`, `loadWorkerConfig()`, `loadRequesterConfig()`, `loadJudgeConfig()` — all use `requireEnv()` which throws on missing values. Dynamic imports in CLI entrypoints avoid requiring `.env` when agents are imported as modules.

## Environment Setup

Copy `.env.example` to `.env`:

```
HEDERA_ACCOUNT_ID / HEDERA_PRIVATE_KEY       # operator account
WORKER_ACCOUNT_ID / WORKER_PRIVATE_KEY        # worker-specific account
REQUESTER_ACCOUNT_ID / REQUESTER_PRIVATE_KEY  # requester-specific account
JUDGE_ACCOUNT_ID / JUDGE_PRIVATE_KEY          # judge-specific account
ANTHROPIC_API_KEY                             # for real Judge (LLMService)
HCS_BOUNTY_TOPIC_ID / HCS_BID_TOPIC_ID / HCS_RESULT_TOPIC_ID / HCS_VERDICT_TOPIC_ID
X402_SERVER_URL      # defaults to http://localhost:4020
RESULTS_WAIT_MS      # Judge debounce window, defaults to 30000
```

## Key Design Decisions

- **ES Modules**: `"type": "module"` in package.json. All imports must use `.js` extensions (e.g., `../types/index.js`) even for `.ts` source files — required by NodeNext module resolution.
- **Agents check `import.meta.url` vs `process.argv[1]`** to detect direct execution — the ESM equivalent of `if __name__ == '__main__'`.
- **x402 is mocked on Hedera**: The protocol is simulated (real x402 targets EVM chains). The mock demonstrates the payment choreography; this distinction should be documented for judges.
- **Judge uses debounce, not a fixed count**: The `resultsWaitMs` timer resets on each new result, so the Judge evaluates `resultsWaitMs` after the *last* result arrives, not after a fixed number.
- **Escrow recipient is the first bidder as placeholder**: The Scheduled TX is created pointing to worker 1's address, but the actual HBAR flows to whoever the Judge designates at signing time.
