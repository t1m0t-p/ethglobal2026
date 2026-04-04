import Anthropic from "@anthropic-ai/sdk";
import type { BidMessage, BountyStrategy, ResultMessage } from "../types/index.js";

// ──────────────────────────────────────────────
// Judge Evaluation — structured output from LLM
// ──────────────────────────────────────────────

export interface JudgeEvaluation {
  winnerId: string;
  reason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

// ──────────────────────────────────────────────
// LLMService — calls Claude to evaluate competing submissions
// ──────────────────────────────────────────────

export class LLMService {
  private readonly anthropic: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model = "claude-haiku-4-5-20251001") {
    this.anthropic = new Anthropic({ apiKey });
    this.model = model;
  }

  async evaluate(
    taskId: string,
    taskDescription: string,
    results: ResultMessage[],
    bids?: BidMessage[],
    strategy?: BountyStrategy,
  ): Promise<JudgeEvaluation> {
    const effectiveStrategy = strategy ?? "quality";
    const bidMap = new Map((bids ?? []).map((b) => [b.workerId, b]));

    const submissionsText = results
      .map(
        (r, i) => {
          const bid = bidMap.get(r.workerId);
          return (
            `Worker ${i + 1}: ID="${r.workerId}"\n` +
            `  Sources: ${r.data.sources.join(", ")}\n` +
            `  Prices: ${r.data.prices.join(", ")}\n` +
            `  Average: ${r.data.average}` +
            (bid ? `\n  Bid Amount: ${bid.bidAmount} HBAR` : "")
          );
        },
      )
      .join("\n\n");

    const criteriaByStrategy =
      effectiveStrategy === "price"
        ? `EVALUATION CRITERIA — PRICE MODE (priority order):\n` +
          `1. Lower bid amount wins (cheapest worker)\n` +
          `2. If tied on bid, more price sources is better\n` +
          `3. If still tied, lower inter-source price variance wins`
        : `EVALUATION CRITERIA — QUALITY MODE (priority order):\n` +
          `1. More price sources is better (3 > 2 > 1)\n` +
          `2. Lower inter-source price variance is better (tighter agreement = more trustworthy)\n` +
          `3. If still tied, the worker with more sources wins`;

    const prompt =
      `You are an impartial judge evaluating submissions from AI worker agents.\n\n` +
      `TASK: ${taskDescription} (ID: ${taskId})\n` +
      `STRATEGY: ${effectiveStrategy}\n\n` +
      `SUBMISSIONS:\n${submissionsText}\n\n` +
      `${criteriaByStrategy}\n\n` +
      `To compute variance: for each submission, calculate the average of (price - mean)^2 across all its prices.\n\n` +
      `Respond ONLY with this JSON object and nothing else (no markdown, no code fences):\n` +
      `{"winnerId": "<exact workerId string from submissions above>", "reason": "<one sentence explaining why this worker won>", "confidence": "<HIGH|MEDIUM|LOW>"}`;

    const message = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 256,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    // Strip any accidental markdown code fences
    const jsonText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let parsed: JudgeEvaluation;
    try {
      parsed = JSON.parse(jsonText) as JudgeEvaluation;

      // Validate that winnerId is one of the actual submitted worker IDs
      const validIds = results.map((r) => r.workerId);
      if (!validIds.includes(parsed.winnerId)) {
        throw new Error(`LLM returned unknown winnerId: ${parsed.winnerId}`);
      }
    } catch (err) {
      console.warn(`[llm] JSON parse failed (${String(err)}) — falling back to algorithmic evaluation`);
      return new MockLLMService().evaluate(taskId, taskDescription, results, bids, strategy);
    }

    console.log(
      `[llm] Winner: ${parsed.winnerId} — "${parsed.reason}" (confidence: ${parsed.confidence})`,
    );
    return parsed;
  }
}

// ──────────────────────────────────────────────
// MockLLMService — deterministic algorithmic evaluation, no API key needed
// ──────────────────────────────────────────────

export class MockLLMService {
  async evaluate(
    _taskId: string,
    _taskDescription: string,
    results: ResultMessage[],
    bids?: BidMessage[],
    strategy?: BountyStrategy,
  ): Promise<JudgeEvaluation> {
    if (results.length === 0) {
      throw new Error("Cannot evaluate: no results submitted");
    }

    const effectiveStrategy = strategy ?? "quality";
    const bidMap = new Map((bids ?? []).map((b) => [b.workerId, b]));

    // Score each result
    const scored = results.map((r) => {
      const variance =
        r.data.prices.length > 0
          ? r.data.prices.reduce((sum, p) => sum + Math.pow(p - r.data.average, 2), 0) /
            r.data.prices.length
          : Infinity;
      const bidAmount = bidMap.get(r.workerId)?.bidAmount ?? Infinity;
      return { result: r, sourcesCount: r.data.sources.length, variance, bidAmount };
    });

    if (effectiveStrategy === "price") {
      // Price mode: lowest bid first, then quality as tiebreaker
      scored.sort((a, b) => {
        if (a.bidAmount !== b.bidAmount) return a.bidAmount - b.bidAmount;
        if (b.sourcesCount !== a.sourcesCount) return b.sourcesCount - a.sourcesCount;
        return a.variance - b.variance;
      });
    } else {
      // Quality mode: sources DESC, then variance ASC
      scored.sort((a, b) => {
        if (b.sourcesCount !== a.sourcesCount) return b.sourcesCount - a.sourcesCount;
        return a.variance - b.variance;
      });
    }

    const winner = scored[0];
    const reason =
      effectiveStrategy === "price"
        ? `Lowest bid (${winner.bidAmount} HBAR) with ${winner.sourcesCount} sources — algorithmic evaluation (price mode)`
        : `Most price sources (${winner.sourcesCount}) with lowest variance (${winner.variance.toFixed(2)}) — algorithmic evaluation (quality mode)`;

    const evaluation: JudgeEvaluation = {
      winnerId: winner.result.workerId,
      reason,
      confidence: "HIGH",
    };

    console.log(
      `[mock-llm] Winner: ${evaluation.winnerId} — "${evaluation.reason}"`,
    );
    return evaluation;
  }
}
