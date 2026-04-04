# Hivera 🤖 — Setup Guide

Follow these steps to set up the Hivera development environment.

## 📋 Prerequisites
- Node.js (v20+)
- npm
- TypeScript Knowledge
- Hedera Testnet Account (Get one at [portal.hedera.com](https://portal.hedera.com/))

## 🛠️ Step 1: Clone & Install Dependencies
1.  Clone the repository.
2.  Install all required packages:
    ```bash
    npm install
    ```

## 🔐 Step 2: Configure Environment
1.  Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
2.  Open `.env` and fill in your Hedera credentials and AI provider keys.

## 🚀 Step 3: Run the Demo
Run the current progress demo to see the agents in action:
```bash
npm run demo
```

## 🧪 Step 4: Run Tests
Execute the unit tests using Jest:
```bash
npm test
```

## 🐳 Troubleshooting
Check [Troubleshooting.md](TROUBLESHOOTING.md) for common setup issues.
