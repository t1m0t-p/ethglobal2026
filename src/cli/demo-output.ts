import { CLIOutput } from './output.js';
import bounties from '../test-data/bounties.json' with { type: 'json' };
import results from '../test-data/results.json' with { type: 'json' };
import verdicts from '../test-data/verdicts.json' with { type: 'json' };

async function runDemo() {
  console.log('\n--- AGENTBAZAAR CLI OUTPUT DEMO ---\n');

  CLIOutput.printBounty(bounties[0]);
  
  // Fake some bids
  CLIOutput.header('Agent Bids (Topic B)');
  CLIOutput.printBid({ workerId: '0.0.55555', bidAmount: bounties[0].reward });
  CLIOutput.printBid({ workerId: '0.0.66666', bidAmount: bounties[0].reward + 5 });
  console.log(CLIOutput.separator);

  CLIOutput.printResult(results[0]);
  CLIOutput.printVerdict(verdicts[0]);

  CLIOutput.success('The full cycle was completed autonomously on Hedera Testnet!');
}

runDemo().catch(err => {
  console.error('Demo failed:', err);
});
