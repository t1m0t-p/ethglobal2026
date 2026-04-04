# Hivera 🤖 — Troubleshooting Guide

Common issues encountered while developing or running the Hivera multi-agent system.

## 📡 Hedera Connection Issues
- **`TIMEOUT ERROR`**: Ensure your Hedera network is set to `testnet` and that you have a stable internet connection.
- **`INVALID_ACCOUNT_ID`**: Double-check your `HEDERA_ACCOUNT_ID` in `.env`. Ensure it's in the format `0.0.XXXXX`.

## 🤖 AI Agent Failures
- **`No Response from LLM`**: Ensure your `CLAUDE_API_KEY` is valid and hasn't exceeded its quota.
- **`Verdict Parsing Error`**: The LLM might have returned a non-JSON response. Check your `JudgeAgent` logs.

## 💳 Payment Flow
- **`INSUFFICIENT_FUNDS`**: Ensure all agents have enough Testnet HBAR. Get more at [testnet.hedera.com](https://testnet.hedera.com/).
- **`SCHEDULED_TRANSACTION_EXPIRED`**: Scheduled transactions have a dynamic expiration. If the demo stalls, you might need to recreate the escrow.

## 💻 Development
- **`MODULE_NOT_FOUND`**: Run `npm install` to ensure all dependencies are correctly linked.
- **`TSX Error`**: Make sure you're using `tsx` or `ts-node` for running TypeScript files directly.
