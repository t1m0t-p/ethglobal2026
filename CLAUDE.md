# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AgentBazaar** — a multi-agent autonomous labor market on Hedera, built for ETHGlobal Cannes 2026. Agents (Requester, Worker×2, Judge) negotiate and execute tasks entirely on Hedera's infrastructure.

Target prizes: Hedera AI & Agentic Payments ($6k) + ENS stretch ($5k).

## Commands

```bash
npm run build          # TypeScript type-check only (tsc --noEmit, no emit)
npm run x402-server    # Start mock x402 payment server on port 4020
npm run worker:mock    # Run Worker agent with mock/hardcoded bounty (no Hedera)
npm run worker         # Run Worker agent against real Hedera testnet
```

> No test runner is configured yet. `tsx` is used for direct TypeScript execution (no compile step needed to run).

## Architecture

### Agent Roles

| Agent | File | Responsibility |
|---|---|---|
| Worker | `src/agents/worker.ts` | Discovers bounties on HCS, bids, fetches BTC price via x402, posts result |
| Worker (mock) | `src/agents/worker-mock.ts` | Same flow using `MockHCSService` and hardcoded bounty — no real Hedera needed |
| Requester | _(not yet built)_ | Posts bounties, creates Scheduled Transaction escrow |
| Judge | _(not yet built)_ | Reads results, calls LLM, posts verdict, releases HTS payment |

### Services Layer (`src/services/`)

- **`hcs.ts`** — `HCSService` (real Hedera) and `MockHCSService` (in-memory, for testing). Both implement `IHCSService`. Use `MockHCSService.simulateMessage()` to inject test messages.
- **`x402-client.ts`** — `fetchWithPayment()` implements the x402 protocol: initial request → 402 response → parse `X-Payment-Required` header → sign → retry with `X-Payment` header. `createMockPaymentSigner()` returns a fake signer for testing.
- **`price-fetcher.ts`** — Fetches BTC price from CoinGecko, Kraken, and Binance in parallel. Requires ≥2 successful sources. Used by both the x402 mock server and directly.

### x402 Mock Server (`src/x402-mock-server/server.ts`)

Express server simulating the x402 payment protocol. Endpoint `GET /api/v1/btc-price`:
- Returns HTTP 402 with `X-Payment-Required: <base64 JSON>` when no payment header
- Validates `X-Payment: <base64 JSON>` on retry
- Returns real BTC prices (falls back to hardcoded if APIs fail)

Payment payloads are base64-encoded JSON throughout (both headers use this encoding).

### Types (`src/types/index.ts`)

All HCS message contracts are here: `BountyMessage`, `BidMessage`, `ResultMessage`, `VerdictMessage`. The `WorkerState` enum defines the agent state machine. `IHCSService` is the interface both real and mock services implement.

### Config (`src/config/hedera.ts`)

`createHederaClient()`, `loadTopicIds()`, `loadWorkerConfig()` — all require environment variables via `requireEnv()` which throws on missing values.

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `HEDERA_ACCOUNT_ID` / `HEDERA_PRIVATE_KEY` — operator account
- `WORKER_ACCOUNT_ID` / `WORKER_PRIVATE_KEY` — worker-specific account
- `HCS_BOUNTY_TOPIC_ID`, `HCS_BID_TOPIC_ID`, `HCS_RESULT_TOPIC_ID`, `HCS_VERDICT_TOPIC_ID` — created by Dev B, shared with all devs
- `X402_SERVER_URL` — defaults to `http://localhost:4020`

## Key Design Decisions

- **ES Modules**: `"type": "module"` in package.json. All imports must use `.js` extensions (e.g., `../types/index.js`) even for `.ts` source files — this is required by NodeNext module resolution.
- **`WorkerAgent` is dependency-injected**: Constructor takes `IHCSService` and `PaymentSigner`, making it fully testable without Hedera. The CLI entrypoint wires real dependencies.
- **Agents check `import.meta.url` vs `process.argv[1]`** to detect direct execution — this is the ESM equivalent of `if __name__ == '__main__'`.
- **x402 is mocked on Hedera**: The protocol is simulated (real x402 targets EVM chains). The mock demonstrates the payment choreography; README documents this distinction for judges.
