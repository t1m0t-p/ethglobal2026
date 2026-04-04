# Hivera 🐝 — Setup Guide

Follow these steps to set up the Hivera development environment.

## Prerequisites
- Node.js (v20+)
- npm
- TypeScript Knowledge
- Hedera Testnet Account (Get one at [portal.hedera.com](https://portal.hedera.com/))

## Step 1: Clone & Install Dependencies
1.  Clone the repository.
2.  Install all required packages:
    ```bash
    npm install
    ```

## Step 2: Hivera Testnet Setup (One-Shot)

Run the bootstrap script to create all needed HCS topics and the HIVE token automatically:

```bash
# Ensure HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY are in .env
npm run setup
```

## Step 3: Configure Environment
1.  Copy any remaining IDs from the setup output into your `.env`.
2.  Ensure your `CLAUDE_API_KEY` is set.

## Step 3: Run the Demo
Run the current progress demo to see the agents in action:
```bash
npm run demo
```

## Step 4: Run Tests
Execute the unit tests using Jest:
```bash
npm test
```

## Troubleshooting
Check [Troubleshooting.md](TROUBLESHOOTING.md) for common setup issues.
