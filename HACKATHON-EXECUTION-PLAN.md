# Hivera — Hackathon Execution Plan

**Event:** ETHGlobal Cannes 2026  
**Target Prizes:** Hedera AI & Agentic Payments ($6,000) + ENS Integration ($5,000 stretch)  
**Timeline:** 3 days + pre-hackathon prep  
**Team:** 3 developers (1 beginner)

---

## Table of Contents

1. [Plan Validation Summary](#plan-validation-summary)
2. [Agent Architecture](#agent-architecture)
3. [Pre-Hackathon Checklist](#pre-hackathon-checklist)
4. [Three-Developer Work Split](#three-developer-work-split)
5. [Implementation Timeline](#implementation-timeline)
6. [Sync Points & Integration](#sync-points--integration)
7. [Risk Mitigation](#risk-mitigation)

---

## Plan Validation Summary

### Strengths ✅

1. **Excellent scope clarity** — Three-tier agent system with clear payment choreography. Task (BTC price averaging) is intentionally simple.
2. **Strong Hedera integration** — Hits HCS, HTS, Scheduled Transactions, HCS-14 identity, x402, A2A. Ambitious but well-planned.
3. **Realistic timeline** — 3 days is tight but doable if scaffolded pre-hackathon.
4. **Prize alignment** — Targets both Hedera ($6k) and ENS stretch ($5k) intelligently.
5. **Risk-aware** — Fallbacks documented (A2A → HCS messages, x402 → custom middleware).

### Critical Gaps & Mitigations 🚨

| Gap | Impact | Fix |
|---|---|---|
| **x402 on Hedera unclear** | Hedera isn't EVM-native; x402 designed for Base/Polygon | Pre-build mock x402 server before Day 1. Simulate protocol, don't integrate Coinbase directly. |
| **A2A protocol applicability** | Google A2A is for agents.google.com ecosystem | **Decision needed:** Use A2A as-is OR treat as inspiration for HCS-based message negotiation. Be explicit in README. |
| **No smart contracts mentioned** | Plan shows HTS but unclear if using Solidity or just JS SDK | **Clarify:** If JS-only, state clearly. If contracts needed, add to Day 1 plan. |
| **Judge LLM determinism** | "Structured prompt" is vague; what if LLM disagrees on re-run? | Pre-write Judge prompt. Test 3× on dummy data before hackathon. Bake into repo. |
| **Demo video clarity** | Audience may not know A2A or x402 | Record demo pre-event. Walk output explicitly: "Here's the bid format…" Don't assume knowledge. |
| **No validation/user testing** | Major scoring gap for "Validation" criterion | Plan: 1 external tester runs demo, provide 1-sentence feedback before final push. |

### Projected Score (Once Built)

| Criterion | Score | Reasoning |
|---|---|---|
| Innovation | 4.5/5 | Multi-agent labor market is novel. Dock 0.5 for x402/A2A applicability. |
| Feasibility | 4/5 | Sound concept, x402 on Hedera is experimental. Show working mock. |
| Execution | 4/5 | 3-day build is tight; hit it with Day 1 core + Day 2 flows. |
| **Integration** | **5/5** | HCS, HTS, Scheduled Txns, Identity, x402. Multiple services + creativity = maxed. |
| Validation | 2/5 | **Major gap.** Add external tester feedback. |
| **Success** | **4/5** | Creates Hedera accounts, generates HCS + HTS TPS. Real but modest impact. |
| Pitch | 4/5 | "AIs hiring AIs" is catchy. Add 1-sentence market insight. |
| **Estimated Grade: 82–85%** (once cleanly built) |

---

## Agent Architecture

### Total Agent Headcount: 4 agents (minimum)

| Role | Count | Critical Responsibility |
|---|---|---|
| **Requester Agent** | 1 | Post bounty, create escrow (Scheduled Txn), lock HBAR |
| **Worker Agents** | 2–3 | Discover bounties, bid, execute task, make x402 calls, post results |
| **Judge Agent** | 1 | Read submissions, call LLM, post verdict, release HTS payment |

**Recommended for demo:** 1 Requester + 2 Workers + 1 Judge = 4 agents  
(If Day 3 goes smoothly, spin up Worker #3. Don't over-engineer demo.)

### Why Worker Agent First? (Critical Path)

1. **Biggest unknown:** x402 integration is riskiest. Test it early in isolation.
2. **Testable solo:** Hardcode a bounty, have Worker respond. No Requester/Judge needed yet.
3. **Unblocks everything:** Once Worker message shapes are locked, Requester/Judge can depend on them.
4. **De-risk early:** If x402 doesn't work, find out Day 0–1, pivot immediately (→ plain HTTP).

---

## Pre-Hackathon Checklist

**Timeline: 1–2 weeks before hackathon**

### Week Before (High Priority)

- [ ] **Set up repo skeleton & push to GitHub**
  - Empty `src/agents/`, `src/services/`, `README.md`
  - Judges will check for public repo; have it live early.

- [ ] **Build & test x402 mock server**
  - Single endpoint that returns HTTP 402
  - Accepts payment signature, returns BTC price data
  - This is your biggest unknown. **Prove it works end-to-end.**
  - Recommendation: Use a Node.js Express server locally, hardcode response

- [ ] **Clarify A2A vs HCS-based bidding**
  - Decision: Use Google A2A protocol as-specified? Or pivot to pure HCS message topics for bids?
  - Document choice in plan. Commit to it. Don't flip-flop on Day 1.

- [ ] **Pre-write Judge evaluation prompt**
  - Test Claude API prompt 3 times on dummy price submissions
  - Check determinism (same input → same verdict)
  - Bake prompt into repo before hackathon starts

- [ ] **Hedera account setup & testnet HBAR**
  - Create 4 Hedera accounts (one per agent type)
  - Request testnet HBAR from faucet for each
  - Confirm SDK auth works: simple HCS topic creation test

- [ ] **Lock down HCS message formats**
  - Define JSON structure for: Bounty, Bid, Result, Verdict
  - All 3 devs should agree on these by Day 0
  - Write to `docs/API.md` before hackathon

---

## Three-Developer Work Split

### Overview

- **Dev A:** Worker Agent + x402 (Risk De-Risking Path)
- **Dev B:** Requester + Judge + Payment Orchestration (Hedera Infrastructure)
- **Dev C:** Infrastructure, Testing, Documentation (Beginner-Friendly)

---

## Developer A: Worker Agent + x402

**Focus:** Risky, domain-specific work. De-risk x402 integration. Enable all other work.

### Day 1 (8–10 hours)

| Time | Task | Deliverable |
|---|---|---|
| **Hour 0–2** | Mock bounty & x402 setup | Mock x402 server locally returning HTTP 402 + BTC price |
| **Hour 2–4** | Worker HCS subscription | Worker can parse hardcoded bounty from HCS |
| **Hour 4–7** | **x402 integration (CRITICAL)** | Worker calls x402 → gets price → handles 402 response → retries with payment. Test 10×. |
| **Hour 7–10** | Result posting & logging | Worker posts result JSON to HCS. Basic demo-friendly logging. |

**Deliverable by End of Day 1:** Worker successfully calls x402 mock, posts result to HCS results topic.

### Day 2 (8–10 hours)

| Time | Task | Notes |
|---|---|---|
| **Hour 0–2** | Bid negotiation (Optional A2A) | If A2A works: submit bids via A2A. If stalls: use HCS bids topic instead. |
| **Hour 2–4** | Spin up Worker #2 | Copy-paste Worker logic, instantiate with different ID. Run both competing. |
| **Hour 4–8** | Edge cases & robustness | Handle x402 failures (retry), HCS drops (reconnect), invalid messages (skip). 30s timeout. |
| **Hour 8–10** | Integration test with Dev B | Receive real Requester bounty. Receive real Judge verdict. Run full flow. |

**Deliverable by End of Day 2:** 2 workers compete on real Hedera infrastructure. x402 is battle-tested.

### Day 3 (4–6 hours)

- [ ] Bug fixes from integration
- [ ] CLI output formatting (show prices fetched, averages, bid submission)
- [ ] Demo recording: "Worker discovers → makes x402 calls → posts results"

### Code Structure (Dev A)

```
src/
├── agents/
│   ├── worker.ts           # Main Worker logic
│   └── worker-mock.ts      # Test stub using hardcoded bounty
├── services/
│   ├── hcs.ts              # HCS subscription & posting
│   ├── x402-client.ts      # x402 payment flow (HTTP 402 handling)
│   └── price-fetcher.ts    # BTC price aggregation from 3 sources
└── test-data/
    └── bounties.json       # Hardcoded bounty for solo testing
```

---

## Developer B: Requester + Judge + Payment Orchestration

**Focus:** Hedera infrastructure. HCS topics, escrow, payment, LLM evaluation.

### Day 1 (8–10 hours)

| Time | Task | Deliverable |
|---|---|---|
| **Hour 0–2** | HCS setup | Create 4 HCS topics (bounties, bids, results, verdicts). **Share topic IDs with Dev A & C.** |
| **Hour 2–4** | Requester bounty posting | `postBounty(task, reward, deadline)` function. Post test bounty. Log to console. |
| **Hour 4–6** | Escrow setup (Scheduled Txn) | Create HTS token or use HBAR. Lock funds via Scheduled Transaction. Verify on Hashscan. |
| **Hour 6–8** | Judge basic verdict (hardcoded) | Subscribe to results. Hardcode: "Winner = result with avg closest to real price." Post verdict to HCS. |
| **Hour 8–10** | HTS payment release | `releasePayment(winnerId, amount)` function. Confirm on Hashscan. |

**Deliverable by End of Day 1:** Escrow locked, payment released. Full flow works end-to-end with hardcoded logic.

### Day 2 (8–10 hours)

| Time | Task | Notes |
|---|---|---|
| **Hour 0–2** | Bid acceptance logic (Requester) | Subscribe to bids topic. Accept/reject bids. Hardcode accept first 2. |
| **Hour 2–4** | Judge LLM integration | Replace hardcoded eval with Claude API. Pre-test prompt 3×. Log LLM response. |
| **Hour 4–6** | HCS-14 agent identity (optional) | Register identities. Store metadata in HCS. Skip if time pressure. |
| **Hour 6–8** | Full payment flow with Dev A | Receive real Worker submissions. Judge evaluates. Payment released correctly. |
| **Hour 8–10** | Integration test | Multiple Workers → Judge picks winner → Payment correct. |

**Deliverable by End of Day 2:** LLM-based judge working. Payment released to correct worker. All Hedera services integrated.

### Day 3 (4–6 hours)

- [ ] Bug fixes
- [ ] CLI output: show bounty creation, escrow lock, verdict, payment release
- [ ] Demo recording: "Requester posts bounty → Judge evaluates → Payment released"

### Code Structure (Dev B)

```
src/
├── agents/
│   ├── requester.ts        # Bounty creation, escrow, bid acceptance
│   ├── judge.ts            # Evaluation, verdict, payment
│   ├── requester-mock.ts   # Test stub using hardcoded bounty
│   └── judge-mock.ts       # Test stub using hardcoded verdict
├── services/
│   ├── hcs.ts              # Topic creation, message posting, subscription
│   ├── hts.ts              # Token creation, transfers
│   ├── escrow.ts           # Scheduled transaction escrow logic
│   ├── identity.ts         # HCS-14 agent identity registration
│   └── llm-judge.ts        # Claude API integration with structured prompt
└── config/
    ├── hedera.ts           # Hedera client setup
    └── constants.ts        # Topic IDs, token IDs, agent keys
```

---

## Developer C: Infrastructure, Testing & Documentation (Beginner)

**Focus:** Everything that enables other devs. Repo structure, test harness, documentation, demo recording.

### Day 1 (8–10 hours)

| Time | Task | Deliverable |
|---|---|---|
| **Hour 0–2** | Repo setup | TypeScript project, dependencies installed, folder structure created. Push to GitHub. |
| **Hour 2–4** | Test data generation | `test-data/bounties.json`, `test-data/results.json`, `test-data/verdicts.json` |
| **Hour 4–6** | Logging & CLI framework | Winston logger + formatters. Pretty terminal output. `demo-output.ts` for visual testing. |
| **Hour 6–8** | README draft + setup docs | README skeleton, `docs/SETUP.md`, `docs/API.md` (message formats), `docs/TROUBLESHOOTING.md` |
| **Hour 8–10** | Integration test harness | Create `src/demo.ts` orchestrator. Build without errors. Zero Hedera calls yet. |

**Deliverable by End of Day 1:** Live GitHub repo. Clear structure. Test data. Passes `npm run build`.

### Day 2 (8–10 hours)

| Time | Task | Purpose |
|---|---|---|
| **Hour 0–2** | Mock agent stubs | Requester/Worker/Judge return test data. Fake end-to-end flow runs cleanly. |
| **Hour 2–4** | Unit test framework | Jest setup. 2–3 tests for parsing/ranking. `npm test` works. |
| **Hour 4–6** | Integration test orchestration | Update `demo.ts` to call real Agent functions as Dev A & B complete them. Daily integration test runs. |
| **Hour 6–8** | CLI output polish | Format output for 5-min demo video. Show bounty posting, escrow, bids, execution, verdict, payment. |
| **Hour 8–10** | Documentation completion | Finalize README, `docs/ARCHITECTURE.md`, `docs/PAYMENT-FLOW.md`. |

**Deliverable by End of Day 2:** Full integration test passing. Demo output ready. Docs complete.

### Day 3 (4–6 hours)

| Time | Task | Output |
|---|---|---|
| **Hour 0–1** | Integration bug fixing | Run `npm run demo` 5 times. Fix errors. All imports resolve. |
| **Hour 1–3** | Demo video recording | Record full flow: bounty → bids → execution → verdict → payment. Cut to ≤ 5 min. |
| **Hour 3–4** | GitHub README polish | Add badges, quick start, embed demo video. Judges can understand in 2 minutes. |
| **Hour 4–6** | Final repo cleanup & push | Remove test data (or move to `examples/`). Create release tag `v1.0-hackathon`. |

**Final Deliverable:** Public GitHub repo. Working demo. 5-min video embedded in README.

### Code Structure (Dev C)

```
src/
├── cli/
│   └── output.ts           # Formatters for pretty terminal output
├── demo.ts                 # Full orchestrator (calls all agents)
└── __tests__/
    ├── bounty.test.ts
    ├── payment.test.ts
    └── verdict.test.ts

docs/
├── SETUP.md                # Step-by-step onboarding
├── API.md                  # HCS message formats
├── ARCHITECTURE.md         # Full system diagram & narrative
├── PAYMENT-FLOW.md         # Payment choreography walkthrough
└── TROUBLESHOOTING.md      # Common issues + fixes

README.md                   # Main entry point for judges
.env.example                # Template for environment variables
```

---

## Implementation Timeline

### Pre-Hackathon (Weeks before)

**All Developers:**
- [ ] Decide A2A vs HCS-based bidding
- [ ] Pre-write Judge LLM prompt, test 3×
- [ ] Build x402 mock server
- [ ] Create Hedera testnet accounts + request HBAR
- [ ] Lock down HCS message formats (`docs/API.md`)
- [ ] Repo skeleton pushed to GitHub

---

### Day 1 — Core Infrastructure (8–10 hours)

**Master Timeline:**

| Hour | Dev A | Dev B | Dev C |
|---|---|---|---|
| **0–2** | x402 mock setup | HCS topic creation | Repo setup + test data |
| **2–4** | Worker HCS subscription | Requester bounty posting | Logging framework |
| **4–6** | x402 client integration | Escrow setup | README draft |
| **6–8** | Result posting + logging | Judge hardcoded verdict | Integration harness |
| **8–10** | Integration checkpoint | Payment release test | Demo.ts skeleton |

**End-of-Day Checkpoint:**
- Dev A: Worker can call x402 mock, post to HCS ✓
- Dev B: Bounty posted, escrow locked, topic IDs shared ✓
- Dev C: Repo live on GitHub, structure complete ✓

---

### Day 2 — Payment Flows & LLM (8–10 hours)

| Hour | Dev A | Dev B | Dev C |
|---|---|---|---|
| **0–2** | Bid negotiation (A2A or HCS) | Bid acceptance logic | Mock agent stubs |
| **2–4** | Worker #2 instantiation | Judge LLM integration | Unit tests (Jest) |
| **4–6** | Edge cases & retry logic | HCS-14 identity (optional) | Integration test updates |
| **6–8** | Full worker integration test | Full payment test with Dev A | CLI output polish |
| **8–10** | Test with real Judge verdicts | Test with real Worker results | Docs finalization |

**End-of-Day Checkpoint:**
- Dev A: 2 workers competing, x402 battle-tested ✓
- Dev B: LLM judge working, payment released correctly ✓
- Dev C: Integration tests passing, demo output ready ✓

---

### Day 3 — Polish & Demo (4–6 hours)

| Hour | Dev A | Dev B | Dev C |
|---|---|---|---|
| **0–1** | Final bug fixes | Final bug fixes | Integration test final run |
| **1–3** | Demo section recording | Demo section recording | Video recording orchestration |
| **3–4** | CLI polish | CLI polish | README polish + upload demo |
| **4–5** | Final code review | Final code review | GitHub release & tag |
| **5–6** | — | — | Final QA + push |

**Final Deliverable:** Public GitHub repo + 5-min demo video + working code ✓

---

## Sync Points & Integration

### Critical Sync Meetings

| Checkpoint | When | Who | Deliverables |
|---|---|---|---|
| **Topic IDs Share** | End of Day 1, Hour 2 | Dev B → Dev A & C | HCS topic IDs in `.env` file |
| **Message Format Finalize** | End of Day 1, Hour 4 | Dev A & B agree | Bounty, Bid, Result, Verdict JSON in `docs/API.md` |
| **Real Bounty Test** | End of Day 1, Hour 8 | Dev B posts → Dev A reads | Worker successfully discovers real Hedera bounty |
| **Real Results Test** | Mid Day 2, Hour 2 | Dev A posts → Dev B reads | Judge successfully reads real Worker submissions |
| **Full E2E Test** | End of Day 2, Hour 10 | All devs | Bounty → bid → execute → judge → pay (real Hedera, real Hbar) |
| **Demo Recording** | Day 3, Hour 1–3 | Dev C orchestrates | All agents running, terminal output clean, video < 5 min |

### Interface Contracts (Agree on Day 0)

**HCS Message Formats:**

```json
// Bounty (Dev B posts to HCS topic A)
{
  "type": "bounty",
  "taskId": "btc-price-fetch",
  "description": "Fetch BTC price from 3 sources, return average",
  "reward": 100,
  "deadline": "2025-04-05T12:00:00Z",
  "requesterAddress": "0.0.XXXXX"
}

// Bid (Dev A posts to HCS topic B)
{
  "type": "bid",
  "taskId": "btc-price-fetch",
  "workerId": "0.0.YYYYY",
  "bidAmount": 50,
  "estimatedTime": "30s"
}

// Result (Dev A posts to HCS topic C)
{
  "type": "result",
  "taskId": "btc-price-fetch",
  "workerId": "0.0.YYYYY",
  "data": {
    "sources": ["coinbase", "kraken", "binance"],
    "prices": [45230.50, 45231.20, 45229.80],
    "average": 45230.50
  }
}

// Verdict (Dev B posts to HCS topic D)
{
  "type": "verdict",
  "taskId": "btc-price-fetch",
  "winnerId": "0.0.YYYYY",
  "reason": "Most accurate price average",
  "paymentAmount": 100
}
```

---

## Risk Mitigation

### High-Risk Items & Fallbacks

| Risk | Mitigation | Fallback |
|---|---|---|
| **x402 integration fails** | Pre-build mock server. Test solo on Day 0. | Use plain HTTP + hardcoded payment proof. Still demonstrates payment choreography. |
| **A2A protocol doesn't work on Hedera** | Pre-test with Dev B. Decide A2A vs HCS early. | Fall back to HCS message topics for bids. Document A2A as "intended" in README. |
| **Judge LLM unreliable** | Pre-write prompt, test 3×. Use structured evaluation criteria. | Fall back to hardcoded evaluation (closest price wins). LLM becomes optional polish. |
| **HTS payment fails** | Test with small amount ($1 HBAR) on Day 1. | Fall back to Scheduled Transaction release without HTS. Still valid escrow demo. |
| **Time pressure** | Prioritize: Day 1 Core Infra → Day 2 Flows → Day 3 Polish. Scope down on Day 2 if needed. | Skip A2A negotiation, skip HCS-14 identity, skip ENS stretch. Keep Worker + Requester + Judge core. |

### Pre-Hackathon Risk De-Risking Checklist

- [ ] x402 mock works end-to-end (solo test, no Hedera)
- [ ] Hedera SDK auth works (simple HCS publish test)
- [ ] Judge LLM prompt deterministic (test 3× on dummy data)
- [ ] A2A or HCS bidding decided + documented
- [ ] Repo skeleton live on GitHub
- [ ] Message formats locked (all 3 devs agree)

---

## Quick Reference: What Each Dev Does

### Dev A (Worker + x402)
- **Core task:** Worker Agent → HCS subscription → x402 client → Result posting
- **Risk owner:** x402 integration (biggest unknown)
- **Day 1 goal:** x402 works end-to-end
- **Day 3 output:** Demo section showing Worker discovery → x402 calls → result posting

### Dev B (Requester + Judge + Payment)
- **Core task:** Requester (bounty + escrow) + Judge (LLM + verdict + payment)
- **Risk owner:** HTS payment + LLM determinism
- **Day 1 goal:** Escrow locked, payment released
- **Day 3 output:** Demo section showing bounty → escrow → verdict → payment

### Dev C (Infrastructure + Testing + Docs)
- **Core task:** Repo structure → test harness → documentation → demo recording
- **Risk owner:** Integration failures + demo clarity
- **Day 1 goal:** Repo live, structure clear, test data ready
- **Day 3 output:** GitHub repo + 5-min demo video + README for judges

---

## Success Criteria (End of Hackathon)

✅ **Must Have:**
- [ ] Public GitHub repo with README
- [ ] 3 agents running: Requester, Worker (2×), Judge
- [ ] HCS bounty posting → HCS results submission (end-to-end flow)
- [ ] Scheduled Transaction escrow created
- [ ] HTS payment released to winning Worker
- [ ] 5-min demo video
- [ ] Code compiles & runs without errors

✅ **Nice to Have:**
- [ ] x402 real integration (vs mock)
- [ ] A2A protocol for bid negotiation
- [ ] HCS-14 agent identity registration
- [ ] ENS integration (Worker addresses registered as `worker1.agentbazaar.eth`)
- [ ] Judge using Claude API instead of hardcoded logic
- [ ] Multiple test scenarios documented

---

## Resources

### Hedera Documentation
- [Hedera Agent Kit (JS/TS)](https://github.com/hashgraph/hedera-agent-kit-js)
- [Hedera Token Service Docs](https://docs.hedera.com/hedera/sdks-and-apis/sdks/token-service)
- [Hedera Consensus Service Docs](https://docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service)
- [Hedera Scheduled Transactions](https://docs.hedera.com/hedera/sdks-and-apis/sdks/schedule-transaction)

### Ecosystem Protocols
- [x402 Protocol](https://www.x402.org/)
- [Google A2A Protocol](https://developers.google.com/agent-to-agent)
- [HCS-14 Standards](https://hashgraphonline.com/docs/standards/)

### Tools
- [Hashscan Explorer](https://hashscan.io/) — Verify transactions, escrow, payments
- [Hedera Faucet](https://testnet.hedera.com/) — Request HBAR for Testnet
- [Hedera Discord](https://hedera.com/discord) — Community support

---

## Notes for Judges (What We're Showing)

> **AgentBazaar** is a multi-agent autonomous labor market on Hedera. Three agents—Requester, Worker(s), and Judge—negotiate and execute a BTC price-fetching task entirely on-chain.
>
> **Why this wins:**
> - **Novel system design:** AIs hiring AIs, recursive economy
> - **Multiple Hedera services:** HCS (bounties), HTS (payment), Scheduled Transactions (escrow), HCS-14 (identity), x402 (external API payments)
> - **Meaningful payment flow:** Real escrow, real token transfers, immutable audit trail
> - **Proof of Hedera network value:** Creates accounts, generates TPS, exposes Hedera to agent ecosystem
>
> **The demo:** Shows bounty posting → worker bidding & execution → judge verdict → payment release, all on Testnet. Full flow in ~5 minutes.

---

## Document Version

- **Created:** 2026-04-03
- **Last Updated:** 2026-04-03
- **Status:** Final Execution Plan
- **Author:** Team Consensus (from Claude Code planning session)
