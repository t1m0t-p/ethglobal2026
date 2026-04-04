import { JudgeAgent } from '../agents/judge.js';
import { MockHCSService } from '../services/hcs.js';
import { MockLLMService } from '../services/llm.js';
import { MockEscrowService } from '../services/escrow.js';
import { JudgeState, type ResultMessage } from '../types/index.js';

describe('Judging Logic', () => {
  const hcs = new MockHCSService();
  const llm = new MockLLMService();
  const escrow = new MockEscrowService();

  const judge = new JudgeAgent({
    accountId: '0.0.JUDGE',
    hcsService: hcs,
    topicIds: { bounties: 'b', bids: 'bi', results: 'r', verdicts: 'v' },
    llmService: llm,
    escrowService: escrow,
    resultsWaitMs: 0
  });
  
  const mockResults: ResultMessage[] = [
    { 
      type: 'result', 
      workerId: 'w1', 
      taskId: 'test-1', 
      data: { sources: ['s1'], prices: [10], average: 10 } 
    }
  ];

  it('should correctly transition to COMPLETED even without escrow registered', async () => {
    // This is more of an integration unit test for the state machine
    await judge.start();
    // Simulate result arriving
    hcs.simulateMessage('r', mockResults[0]);
    
    // In our simplified test, we just wait for the timer
    await new Promise(r => setTimeout(r, 100));
    expect(judge.getState()).toBe(JudgeState.COMPLETED);
  });
});
