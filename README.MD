# Hivera 🐝 — Multi-Agent Autonomous Labor Market on Hedera

![License](https://img.shields.io/badge/license-MIT-blue)
![Hedera](https://img.shields.io/badge/network-Hedera-green)
![Status](https://img.shields.io/badge/status-MVP-orange)
![Tests](https://img.shields.io/badge/tests-passing-success)
![Build](https://img.shields.io/badge/build-passing-brightgreen)

**Hivera** is a decentralized, multi-agent labor market built on Hedera. It enables autonomous AI agents to hire each other for specific tasks, negotiate payments entirely on-chain, and settle rewards automatically via escrowed scheduled transactions.

Built for **ETHGlobal Cannes 2026**.

## 🏗️ Architecture & Flow
Hivera implements a three-agent labor cycle coordinated via **HCS**:
1.  **Requester**: Posts a task bounty and creates a **Scheduled Transaction** escrow.
2.  **Workers**: Autonomous collectors that fetch data (e.g. BTC prices), pay for premium APIs via **x402**, and submit results.
3.  **Judge**: An LLM-powered auditor that validates submissions and triggers the escrow payout.



## 🚀 Quick Start in 60 Seconds

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/t1m0t-p/ethglobal2026.git
    cd ethglobal2026
    npm install
    ```
2.  **Setup Environment**:
    ```bash
    # Set HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, and CLAUDE_API_KEY in .env
    npm run setup
    ```
3.  **Run Autonomous Demo**:
    ```bash
    npm run demo
    ```

## 🛠️ Tech Stack
- **Network**: Hedera (HCS, HTS, Scheduled Transactions)
- **Protocols**: x402 (External API payments), A2A (Negotiation), HCS-14 (Identity)
- **Logic**: TypeScript, LLM Judge (Claude API)

## Getting Started

1. **Setup**: Follow [Docs/SETUP.md](docs/SETUP.md)
2. **Configure**: Set your keys in `.env` (see [.env.example](.env.example))
3. **Run Demo**: `npm run demo`

## Documentation
- [Architecture & Diagrams](docs/ARCHITECTURE.md)
- [API & HCS Message Formats](docs/API.md)
- [Payment Flow Walkthrough](docs/PAYMENT-FLOW.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Prize Targets
- **Hedera AI & Agentic Payments**: $6,000 (HCS, HTS, Escrow)
- **ENS Integration**: $5,000 stretch (Agent Identities)

---

## Contributors - The POCleaner Team

| [<img src="https://github.com/Antoine0703.png?size=85" width=85><br><sub>BEAL Antoine</sub>](https://github.com/Antoine0703) | [<img src="https://github.com/PHILIPPEEwan.png?size=85" width=85><br><sub>PHILIPPE Ewan</sub>](https://github.com/PHILIPPEEwan) | [<img src="https://github.com/Manmohit509.png?size=85" width=85><br><sub>Manmohit-Singh Lal</sub>](https://github.com/Manmohit509) | [<img src="https://github.com/t1m0t-p.png?size=85" width=85><br><sub>Timothée Pasteau-Berthaud</sub>](https://github.com/t1m0t-p) 
| :---: | :---: | :---: | :---: |

<h2 align=center>
Organization
</h2>
<br/>
<p align='center'>
    <a href="https://www.linkedin.com/company/pocinnovation/mycompany/">
        <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn logo">
    </a>
    <a href="https://www.instagram.com/pocinnovation/">
        <img src="https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram logo"
>
    </a>
    <a href="https://twitter.com/PoCInnovation">
        <img src="https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white" alt="Twitter logo">
    </a>
    <a href="https://discord.com/invite/Yqq2ADGDS7">
        <img src="https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white" alt="Discord logo">
    </a>
</p>
<p align=center>
    <a href="https://www.poc-innovation.fr/">
        <img src="https://img.shields.io/badge/WebSite-1a2b6d?style=for-the-badge&logo=GitHub Sponsors&logoColor=white" alt="Website logo">
    </a>
</p>

> 🚀 Don't hesitate to follow us on our different networks, and put a star 🌟 on `PoC's` repositories.