import { JudgeMock } from '../agents/judge-mock.js';

describe('Judging Logic Mock', () => {
  const judge = new JudgeMock();
  
  const mockResults = [
    { workerId: '0.0.1', taskId: 'test-1', data: { average: 45000 } },
    { workerId: '0.0.2', taskId: 'test-1', data: { average: 45010 } }
  ];

  it('should pick the first worker if results are provided', async () => {
    const verdict = await judge.evaluate(mockResults);
    expect(verdict.winnerId).toBe('0.0.1');
    expect(verdict.taskId).toBe('test-1');
  });

  it('should return a default winner if no results are provided', async () => {
    const verdict = await judge.evaluate([]);
    expect(verdict.winnerId).toBe('0.0.99999');
    expect(verdict.taskId).toBe('unknown');
  });
});
