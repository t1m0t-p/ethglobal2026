import fs from 'node:fs';
import path from 'node:path';

const bountiesPath = path.resolve(process.cwd(), 'src/test-data/bounties.json');
const bounties = JSON.parse(fs.readFileSync(bountiesPath, 'utf8'));

describe('Bounty Data Validation', () => {
  it('should have required bounty fields', () => {
    bounties.forEach((bounty: any) => {
      expect(bounty.type).toBe('bounty');
      expect(bounty.taskId).toBeDefined();
      expect(bounty.reward).toBeGreaterThan(0);
      expect(bounty.deadline).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });
  });

  it('should contain at least one bounty', () => {
    expect(bounties.length).toBeGreaterThan(0);
  });
});
