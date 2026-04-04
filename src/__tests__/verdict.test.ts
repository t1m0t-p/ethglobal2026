import fs from 'node:fs';
import path from 'node:path';

const verdictsPath = path.resolve(process.cwd(), 'src/test-data/verdicts.json');
const verdicts = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'));

describe('Verdict Data Validation', () => {
  it('should have required verdict fields', () => {
    verdicts.forEach((verdict: any) => {
      expect(verdict.type).toBe('verdict');
      expect(verdict.taskId).toBeDefined();
      expect(verdict.winnerId).toBeDefined();
      expect(verdict.paymentAmount).toBeGreaterThan(0);
    });
  });

  it('should contain a valid reason string', () => {
    verdicts.forEach((verdict: any) => {
      expect(typeof verdict.reason).toBe('string');
      expect(verdict.reason.length).toBeGreaterThan(5);
    });
  });
});
