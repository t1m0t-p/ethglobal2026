import { MockHCSService } from "../services/hcs.js";
import type { BountyMessage } from "../types/index.js";

describe("HCSService Mocking & Interaction", () => {
  const hcs = new MockHCSService();

  it("should successfully 'publish' and 'subscribe' in mock mode", async () => {
    const topicId = "0.0.12345";
    const testBounty: BountyMessage = {
      type: "bounty",
      taskId: "test-1",
      description: "mock task",
      reward: 100,
      deadline: new Date().toISOString(),
      requesterAddress: "0.0.999",
      strategy: "quality",
    };

    let receivedMessage: any = null;
    await hcs.subscribe(topicId, (msg) => {
      receivedMessage = msg;
    });

    await hcs.publish(topicId, testBounty);
    expect(receivedMessage).toEqual(testBounty);
  });

  it("should handle simulation of external messages correctly", async () => {
    const topicId = "0.0.555";
    let receivedMessage: any = null;
    await hcs.subscribe(topicId, (msg) => {
      receivedMessage = msg;
    });

    const simulatedMessage: any = { 
      type: "result", 
      taskId: "t1", 
      workerId: "w1", 
      data: { sources: [], prices: [], average: 0 } 
    };
    hcs.simulateMessage(topicId, simulatedMessage);
    expect(receivedMessage).toEqual(simulatedMessage);
  });

  it("should maintain a publication log for verification", async () => {
    const hcs2 = new MockHCSService();
    const topicId = "0.0.999";
    const msg: any = { 
      type: "verdict", 
      taskId: "t1", 
      winnerId: "w1", 
      reason: "ok", 
      paymentAmount: 10 
    };

    await hcs2.publish(topicId, msg);
    const logs = hcs2.getPublished();
    expect(logs.length).toBe(1);
    expect(logs[0].topicId).toBe(topicId);
    expect(logs[0].message).toEqual(msg);
  });
});
