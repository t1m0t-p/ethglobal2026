import chalk from 'chalk';

export class CLIOutput {
  static separator = '────────────────────────────────────────────────────────────────────────────────';

  static header(title: string) {
    console.log(`\n${chalk.bgCyan.black.bold(`  ${title.toUpperCase()}  `)}`);
    console.log(chalk.cyan(this.separator));
  }

  static stage(number: number, name: string) {
    console.log(`\n${chalk.magenta.bold(`[STAGE ${number}]`)} ${chalk.white.bold(name)}`);
  }

  static info(label: string, value: any) {
    console.log(`${chalk.blue.bold(label.padEnd(20))}: ${chalk.white(value)}`);
  }

  static success(message: string) {
    console.log(`\n${chalk.green.bold('✔')} ${chalk.green(message)}`);
  }

  static warning(message: string) {
    console.log(`\n${chalk.yellow.bold('⚠')} ${chalk.yellow(message)}`);
  }

  static error(message: string) {
    console.log(`\n${chalk.red.bold('✘')} ${chalk.red(message)}`);
  }

  static printBounty(bounty: any) {
    this.header('New Bounty Posted');
    this.info('Task ID', bounty.taskId);
    this.info('Reward', `${bounty.reward} HBAR`);
    this.info('Deadline', bounty.deadline);
    this.info('Description', bounty.description);
    this.info('Requester', bounty.requesterAddress);
    console.log(chalk.gray(this.separator));
  }

  static printBid(bid: any) {
    this.info('Worker Bid', bid.workerId);
    this.info('Amount', `${bid.bidAmount} HBAR`);
  }

  static printResult(result: any) {
    this.header('Work Result Submitted');
    this.info('Worker ID', result.workerId);
    this.info('Price Average', result.data.average);
    this.info('Sources', result.data.sources.join(', '));
    console.log(chalk.gray(this.separator));
  }

  static printVerdict(verdict: any) {
    this.header('Judge Verdict');
    this.info('Winner ID', verdict.winnerId);
    this.info('Reason', verdict.reason);
    this.info('Payout', `${verdict.paymentAmount} HBAR`);
    this.success('Transaction Completed');
    console.log(chalk.gray(this.separator));
  }
}
