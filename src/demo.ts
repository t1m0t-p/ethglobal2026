import { CLIOutput } from './cli/output.js';
import { RequesterMock } from './agents/requester-mock.js';
import { JudgeMock } from './agents/judge-mock.js';
import resultsData from './test-data/results.json' with { type: 'json' };
import logger from './services/logger.js';

/**
 * HIVERA CORE ORCHESTRATOR
 * This script runs the full multi-agent flow, demonstrating:
 * 1. Bounty posting (Requester Mock)
 * 2. Discovery & Bidding (Worker Simulation)
 * 3. Execution & Submission (Worker Simulation)
 * 4. Assessment & Payout (Judge Mock)
 */
async function main() {
  logger.info('Starting Hivera Demo Orchestration (Day 2 Step 2)');
  
  const requester = new RequesterMock();
  const judge = new JudgeMock();

  // 1. REQUESTER POSTS BOUNTY
  CLIOutput.stage(1, 'POSTING BOUNTY (HCS Topic A)');
  const bounty = await requester.postBounty();
  CLIOutput.printBounty(bounty);

  // 2. WORKERS SUBMIT BIDS (Simulated)
  CLIOutput.stage(2, 'AGENT NEGOTIATION (Topic B)');
  CLIOutput.header('Active Bids Received');
  CLIOutput.printBid({ workerId: '0.0.51234', bidAmount: 100 });
  CLIOutput.printBid({ workerId: '0.0.52345', bidAmount: 110 });
  CLIOutput.success('Winner selected & Escrow (Scheduled Txn) locked!');

  // 3. WORKER SUBMITS RESULT (Simulated from test data)
  CLIOutput.stage(3, 'AGENT EXECUTION & X402 PAYMENT');
  CLIOutput.printResult(resultsData[0]);

  // 4. JUDGE RELEASES VERDICT
  CLIOutput.stage(4, 'JUDGE EVALUATION (CLAUDE 3.5)');
  const verdict = await judge.evaluate(resultsData);
  CLIOutput.printVerdict(verdict);

  CLIOutput.success('The full multi-agent cycle was completed successfully on Hedera!');
  logger.info('Hivera execution finished');
}

main().catch((err) => {
  logger.error('Orchestrator failed:', err);
  process.exit(1);
});
