# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hivera** — a multi-agent autonomous labor market on Hedera, built for ETHGlobal Cannes 2026. Agents (Requester, Worker×2, Judge) negotiate and execute tasks entirely on Hedera's infrastructure.

Target prizes: Hedera AI & Agentic Payments ($6k) + ENS stretch ($5k).

## Commands

```bash
npm run build           # TypeScript type-check only (tsc --noEmit, no emit)

# Initial setup (run once)
npm run setup           # Create HCS topics + HTS token on testnet, print IDs for .env

# Full demo orchestration
npm run demo            # Run complete multi-agent flow: Requester → Workers → Judge (mock payments)
npm run demo:real       # Same flow but with real HBAR payment signing (requires GEMINI_API_KEY)

# x402 mock server (used by demo)
npm run x402-server     # Start mock x402 payment server on port 4020

# Individual agents (unit-testable E2E flows, no shared state)
npm run requester:mock  # Requester E2E test — no Hedera, no external deps
npm run requester       # Requester against real Hedera testnet
npm run requester:interactive  # Interactive CLI for posting bounties with live input
npm run worker:mock     # Worker E2E test — no Hedera, no external deps
npm run worker          # Worker against real Hedera testnet (x402 payment flow)
npm run judge:mock      # Judge E2E test — no Hedera, no LLM API key required
npm run judge           # Judge against real Hedera testnet

# tmux multi-pane launcher (requires tmux)
npm run launch          # Launch all agents in split panes against real Hedera testnet
npm run launch:mock     # Launch all agents in split panes in mock mode (no Hedera)
npm run launch:demo     # Launch demo orchestrator in a single pane

# Unit tests (Jest)
npx jest                # Run all unit tests in src/__tests__/
npx jest --testPathPattern=hcs  # Run a single test file
```

> `tsx` runs TypeScript directly. Each `*:mock` script is a self-contained E2E test with assertions that exits 0 on success. The `demo` script orchestrates all agents and services in one process. Unit tests in `src/__tests__/` use Jest with `ts-jest` (ESM preset).

## Architecture

### Agent Roles

| Agent | File | Responsibility |
|---|---|---|
| Requester | `src/agents/requester.ts` | Posts bounties on HCS, collects bids (up to `maxBidsToAccept`), locks HBAR in escrow via Hedera Scheduled Transaction, submits token transfer to Judge for payment release |
| Worker | `src/agents/worker.ts` | Discovers bounties on HCS, bids, fetches BTC price via x402, posts result. (See `gemini-worker.ts` for LLM-powered variant using Hedera Agent Kit.) |
| Judge | `src/agents/judge.ts` | Monitors results, evaluates submissions, posts verdict, signs escrow to release HBAR. Uses configurable LLM provider: hardcoded deterministic algorithm (default, no API key) or Claude API. |

### Full Task Lifecycle

```
Requester → [HCS: bounties] → Workers discover
Workers   → [HCS: bids]     → Requester collects N bids → creates Hedera Scheduled TX (escrow)
Workers   → [HCS: results]  → Judge collects, debounces resultsWaitMs, evaluates (via LLM or deterministic)
Judge     → [HCS: verdicts] → posts winner; executes HTS token transfer to winner; signs Scheduled TX
          → [HBAR released] → on-chain to winner's account
```

**Critical behavior:** The Worker does NOT wait for bid acceptance before executing the task. It bids and immediately fetches the price (via x402 or Gemini). All workers that bid will submit results; the Judge picks the winner among submitted results.

### Services Layer (`src/services/`)

- **`hcs.ts`** — `HCSService` (real Hedera) and `MockHCSService` (in-memory). Both implement `IHCSService`. Use `MockHCSService.simulateMessage()` to inject test messages; `getPublished()` for assertions.
- **`escrow.ts`** — `EscrowService` wraps Hedera `ScheduleCreateTransaction` (locks HBAR without executing) and `ScheduleSignTransaction` (releases on Judge signature). `MockEscrowService` is in-memory with `isReleased()` for assertions.
- **`hts.ts`** — Hedera Token Service: token association (required before workers can receive HIVE tokens) and token transfer (Judge releases reward to winning Worker).
- **`llm.ts`** — Judge decision-making. Configurable via `LLM_PROVIDER` env: `hardcoded` uses deterministic algorithm (most sources wins, then lowest price variance); `claude` calls Claude API. `MockLLMService` provides deterministic fallback.
- **`llm-judge.ts`** — Alternative Judge implementation integrating with `llm.ts` service layer for structured evaluation.
- **`x402-client.ts`** — `fetchWithPayment()` implements the x402 protocol: initial request → 402 → parse `X-Payment-Required` header → sign → retry with `X-Payment` header. Headers are base64-encoded JSON.
- **`price-fetcher.ts`** — Fetches BTC price from CoinGecko, Kraken, and Binance in parallel. Requires ≥2 successful sources.
- **`gemini-worker.ts`** — Worker variant powered by Google Gemini 2.5 Flash + Hedera Agent Kit for autonomous task execution (requires `GEMINI_API_KEY`).
- **`logger.ts`** — Winston-based structured logging for all agents and services.

### CLI Utilities (`src/cli/`)

- **`output.ts`** — `CLIOutput` static class with chalk-based formatted console output (headers, stages, info labels, success/error/warning). Used by demo and interactive scripts.
- **`demo-output.ts`** — Structured output helpers specific to the demo orchestrator flow.

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

1. Copy `.env.example` to `.env`
2. Fill in operator account: `HEDERA_ACCOUNT_ID` / `HEDERA_PRIVATE_KEY`
3. Run `npm run setup` — creates HCS topics and HTS token, prints IDs
4. Copy output into `.env`: `HCS_*_TOPIC_ID` and `HTS_TOKEN_ID`

**Optional agent accounts** (default to operator):
```
WORKER_ACCOUNT_ID / WORKER_PRIVATE_KEY
REQUESTER_ACCOUNT_ID / REQUESTER_PRIVATE_KEY
JUDGE_ACCOUNT_ID / JUDGE_PRIVATE_KEY
```

**LLM configuration**:
```
LLM_PROVIDER=hardcoded         # (default) deterministic algorithm, no API key needed
LLM_PROVIDER=claude            # uses Claude API
ANTHROPIC_API_KEY=sk-ant-...   # for claude provider
ANTHROPIC_MODEL=claude-sonnet-4-6  # (optional) defaults to claude-haiku-4-5-20251001
```

**Worker LLM (Gemini variant)**:
```
GEMINI_API_KEY=AIzaSy...       # for gemini-worker.ts with Hedera Agent Kit
```

**Other**:
```
X402_SERVER_URL=http://localhost:4020    # x402 mock server, set port via X402_SERVER_PORT
RESULTS_WAIT_MS=30000                    # Judge debounce window, defaults to 30000
```

## Testing

Agents are fully testable via dependency injection — all use mocks for services. Each `*:mock.ts` runs self-contained E2E assertions:

```bash
npm run worker:mock     # Tests Worker E2E flow (discovery → bid → fetch price → result)
npm run requester:mock  # Tests Requester E2E flow (post bounty → collect bids → escrow)
npm run judge:mock      # Tests Judge E2E flow (collect results → evaluate → verdict)
```

Inline E2E assertions in `*:mock.ts` files — exit code 0 = success, non-zero = failure. Unit tests in `src/__tests__/` cover data validation and evaluation logic (bounty schema, HCS message format, ranking, strategy, verdict). Run with `npx jest`; config in `jest.config.js` (ts-jest ESM preset, matches `**/__tests__/**/*.test.ts`).

## Key Design Decisions

- **ES Modules**: `"type": "module"` in package.json. All imports must use `.js` extensions (e.g., `../types/index.js`) even for `.ts` source files — required by NodeNext module resolution.
- **Agents check `import.meta.url` vs `process.argv[1]`** to detect direct execution — the ESM equivalent of `if __name__ == '__main__'`.
- **Dependency injection pattern**: All agents and services accept injected dependencies, enabling full testability without Hedera or API calls. The CLI entrypoint wires real services; `*-mock.ts` files wire mocks.
- **Dual Worker implementations**: Standard `worker.ts` uses x402 payment protocol; `gemini-worker.ts` uses Google Gemini 2.5 Flash with Hedera Agent Kit for autonomous execution.
- **Two demo modes**: `demo.ts` uses mock payment signatures (no real HBAR spent); `demo-real.ts` uses `createRealPaymentSigner` for actual Hedera transfers and real Gemini API if `GEMINI_API_KEY` is set.
- **Configurable Judge evaluation**: `LLM_PROVIDER` env controls verdict logic: `hardcoded` (deterministic, no API key) or `claude` (uses Claude API).
- **x402 is mocked on Hedera**: Real x402 targets EVM chains. The mock on Hedera demonstrates payment choreography and protocol flow.
- **Judge uses debounce, not a fixed count**: The `resultsWaitMs` timer resets on each new result, so the Judge evaluates `resultsWaitMs` after the *last* result arrives, not after a fixed number.
- **Escrow & payment flow**: Requester creates Hedera Scheduled TX to lock HBAR (without execution). Judge then executes HTS token transfer to winner, then signs Scheduled TX to release HBAR on-chain. Actual payment recipient can differ from escrow recipient.
