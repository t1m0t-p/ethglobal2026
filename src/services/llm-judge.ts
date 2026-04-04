/**
 * llm-judge.ts — Modular LLM evaluation for the Judge agent.
 *
 * The LLMJudgeProvider interface abstracts the model backend. Any provider
 * (Claude, Gemini, OpenAI, hardcoded) can be swapped in by:
 *   1. Implementing LLMJudgeProvider
 *   2. Registering it in createJudgeProvider()
 *   3. Setting LLM_PROVIDER=<name> in .env
 *
 * Current providers:
 *   hardcoded — no API key; winner = closest price avg to median
 *   claude    — Anthropic Claude API; requires @anthropic-ai/sdk + ANTHROPIC_API_KEY
 */

import type { ResultMessage, BountyMessage } from "../types/index.js";

// ──────────────────────────────────────────────
// Interface & types
// ──────────────────────────────────────────────

export interface JudgeDecision {
  winnerId: string;
  reason: string;
}

export interface LLMJudgeProvider {
  readonly name: string;
  evaluate(params: {
    submissions: ResultMessage[];
    task: BountyMessage;
  }): Promise<JudgeDecision>;
}

// ──────────────────────────────────────────────
// HardcodedJudgeProvider — no external deps
// ──────────────────────────────────────────────

export class HardcodedJudgeProvider implements LLMJudgeProvider {
  readonly name = "hardcoded";

  async evaluate({
    submissions,
  }: {
    submissions: ResultMessage[];
    task: BountyMessage;
  }): Promise<JudgeDecision> {
    if (submissions.length === 0) {
      throw new Error("No submissions to evaluate");
    }

    if (submissions.length === 1) {
      const only = submissions[0]!;
      return {
        winnerId: only.workerId,
        reason: "Only submission received — automatic winner",
      };
    }

    // Compute median of all averages
    const averages = submissions.map((s) => s.data.average).sort((a, b) => a - b);
    const mid = Math.floor(averages.length / 2);
    const median =
      averages.length % 2 === 0
        ? ((averages[mid - 1]! + averages[mid]!) / 2)
        : averages[mid]!;

    // Pick the submission closest to the median
    let best = submissions[0]!;
    let bestDelta = Math.abs(best.data.average - median);

    for (const sub of submissions.slice(1)) {
      const delta = Math.abs(sub.data.average - median);
      if (delta < bestDelta) {
        best = sub;
        bestDelta = delta;
      }
    }

    return {
      winnerId: best.workerId,
      reason: `Price average $${best.data.average.toFixed(2)} was closest to median $${median.toFixed(2)} (delta: $${bestDelta.toFixed(2)})`,
    };
  }
}

// ──────────────────────────────────────────────
// ClaudeJudgeProvider — Anthropic Claude API
// ──────────────────────────────────────────────

/**
 * Uses claude-sonnet-4-6 to evaluate price submissions.
 * Requires: npm install @anthropic-ai/sdk
 *           ANTHROPIC_API_KEY in .env
 */
export class ClaudeJudgeProvider implements LLMJudgeProvider {
  readonly name = "claude";
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = "claude-sonnet-4-6") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async evaluate({
    submissions,
    task,
  }: {
    submissions: ResultMessage[];
    task: BountyMessage;
  }): Promise<JudgeDecision> {
    // Dynamic import keeps @anthropic-ai/sdk optional
    const { default: Anthropic } = await import("@anthropic-ai/sdk").catch(() => {
      throw new Error(
        "ClaudeJudgeProvider requires @anthropic-ai/sdk. Run: npm install @anthropic-ai/sdk",
      );
    });

    const client = new Anthropic({ apiKey: this.apiKey });

    const submissionText = submissions
      .map(
        (s, i) =>
          `Submission ${i + 1}:\n  workerId: ${s.workerId}\n  sources: ${s.data.sources.join(", ")}\n  prices: ${s.data.prices.map((p) => `$${p.toFixed(2)}`).join(", ")}\n  average: $${s.data.average.toFixed(2)}`,
      )
      .join("\n\n");

    const prompt = `You are a judge evaluating price-fetching submissions for a decentralized labor market.

Task: ${task.description}
Reward: ${task.reward} HIVE tokens

${submissionText}

Your job: pick the single most accurate and trustworthy submission.
Evaluation criteria (in order of importance):
1. Price average closest to the consensus median across all submissions
2. Number of sources used (more = better)
3. Consistency between sources (low spread = better)

Respond with ONLY valid JSON in this exact format:
{
  "winnerId": "<workerId of winner>",
  "reason": "<one sentence explaining the decision>"
}`;

    const message = await client.messages.create({
      model: this.model,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (!content || content.type !== "text") {
      throw new Error("Unexpected Claude response format");
    }

    // Strip markdown code fences if present
    const raw = content.text.replace(/```(?:json)?\n?/g, "").trim();
    const decision = JSON.parse(raw) as JudgeDecision;

    if (!decision.winnerId || !decision.reason) {
      throw new Error(`Invalid Claude response: ${raw}`);
    }

    return decision;
  }
}

// ──────────────────────────────────────────────
// Factory — selects provider from env or argument
// ──────────────────────────────────────────────

/**
 * Create a judge provider.
 *
 * @param type  Provider name: 'hardcoded' | 'claude'. Defaults to LLM_PROVIDER env var, then 'hardcoded'.
 */
export function createJudgeProvider(type?: string): LLMJudgeProvider {
  const providerType = type ?? process.env.LLM_PROVIDER ?? "hardcoded";

  switch (providerType) {
    case "claude": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "LLM_PROVIDER=claude requires ANTHROPIC_API_KEY in .env",
        );
      }
      const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
      console.log(`[judge] LLM provider: Claude (${model})`);
      return new ClaudeJudgeProvider(apiKey, model);
    }

    case "hardcoded":
    default:
      console.log("[judge] LLM provider: hardcoded (median distance)");
      return new HardcodedJudgeProvider();
  }
}
