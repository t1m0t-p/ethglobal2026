import { MockLLMService } from "../services/llm.js";
import type { ResultMessage, BidMessage } from "../types/index.js";

describe("Evaluation Strategy Logic", () => {
  const llm = new MockLLMService();

  const mockResults: ResultMessage[] = [
    {
      type: "result",
      taskId: "test-task",
      workerId: "high-quality-worker",
      data: {
        sources: ["source1", "source2", "source3"],
        prices: [100, 101, 99],
        average: 100,
      },
    },
    {
      type: "result",
      taskId: "test-task",
      workerId: "low-cost-worker",
      data: {
        sources: ["source1"],
        prices: [105],
        average: 105,
      },
    },
  ];

  const mockBids: BidMessage[] = [
    {
      type: "bid",
      taskId: "test-task",
      workerId: "high-quality-worker",
      bidAmount: 200,
      estimatedTime: "10s",
    },
    {
      type: "bid",
      taskId: "test-task",
      workerId: "low-cost-worker",
      bidAmount: 50,
      estimatedTime: "10s",
    },
  ];

  it("should pick the high-quality worker in 'quality' mode", async () => {
    const evaluation = await llm.evaluate(
      "test-task",
      "fetch price",
      mockResults,
      mockBids,
      "quality"
    );
    expect(evaluation.winnerId).toBe("high-quality-worker");
    expect(evaluation.reason).toContain("Most price sources (3)");
  });

  it("should pick the low-cost worker in 'price' mode", async () => {
    const evaluation = await llm.evaluate(
      "test-task",
      "fetch price",
      mockResults,
      mockBids,
      "price"
    );
    expect(evaluation.winnerId).toBe("low-cost-worker");
    expect(evaluation.reason).toContain("Lowest bid (50 HBAR)");
  });

  it("should default to 'quality' mode if strategy is undefined", async () => {
    const evaluation = await llm.evaluate(
      "test-task",
      "fetch price",
      mockResults,
      mockBids,
      undefined
    );
    expect(evaluation.winnerId).toBe("high-quality-worker");
  });

  it("should use quality as a tiebreaker in 'price' mode", async () => {
    const tiedBids: BidMessage[] = [
      { type: "bid", taskId: "t1", workerId: "w1", bidAmount: 50, estimatedTime: "1s" },
      { type: "bid", taskId: "t1", workerId: "w2", bidAmount: 50, estimatedTime: "1s" },
    ];
    const tiedResults: ResultMessage[] = [
      { type: "result", taskId: "t1", workerId: "w1", data: { sources: ["s1"], prices: [10], average: 10 } },
      { type: "result", taskId: "t1", workerId: "w2", data: { sources: ["s1", "s2"], prices: [11, 10], average: 10.5 } },
    ];

    const evaluation = await llm.evaluate("t1", "desc", tiedResults, tiedBids, "price");
    expect(evaluation.winnerId).toBe("w2"); // Same price, but more sources
  });
});
