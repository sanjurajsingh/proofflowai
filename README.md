# ProofFlow AI

AI-powered campaign verification and reward distribution platform built for the GenLayer ecosystem.

ProofFlow AI enables brands to launch campaigns where users complete real-world or online tasks, submit proof, and receive rewards after AI-powered verification.

---

## Overview

ProofFlow AI automates campaign verification using AI instead of manual moderators.

Brands can:

- Create campaigns
- Define verification requirements
- Fund campaign rewards
- Review AI decisions when needed

Workers can:

- Connect their wallet
- Discover campaigns
- Submit proof
- Track verification status
- Claim rewards after approval

---

## Features

### Wallet Authentication

- Wallet-only login
- No email/password accounts
- Web3-native authentication

### Campaign Management

- Create campaigns
- Reward amount per submission
- Maximum participant limit
- Campaign instructions
- Proof requirements

### AI Verification

Every submission is analyzed using Claude AI.

The AI evaluates:

- Relevance
- Quality
- Spam likelihood
- Confidence score

Possible outcomes:

- Approve
- Reject
- Manual Review

High-confidence submissions can be approved automatically.

---

## Fraud Prevention

- Duplicate submission detection
- Cooldown between submissions
- Maximum submissions per user
- Disposable email protection
- Trust score system
- Wallet reputation
- Submission fingerprinting

---

## Reward System

- Wallet balances
- Ledger-based accounting
- Payout requests
- Transaction history
- Secure reward tracking

---

## Analytics

Campaign owners can view:

- Approval rate
- Fraud rate
- Total payouts
- Cost per verified submission
- Top rejection reasons
- Performance charts

---

## Secure Storage

- Private proof storage
- Signed URLs
- Owner-only access
- Brand/Admin moderation access

---

## Tech Stack

Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

Backend

- Supabase
- Edge Functions
- PostgreSQL
- Row Level Security (RLS)

AI

- Anthropic Claude API

Blockchain

- GenLayer Testnet
- Wallet Authentication
- GenLayer-ready reward architecture

---

## Project Status

This repository represents the MVP developed for the GenLayer Hackathon.

Current implementation includes:

- Wallet authentication
- Campaign creation
- AI verification
- Fraud detection
- Moderation workflow
- Reward ledger
- Analytics dashboard
- Secure proof storage

Future improvements include:

- On-chain reward distribution
- Smart contract treasury
- Native GenLayer reward claims
- Decentralized verification

---

## Built with Lovable

This project was initially bootstrapped using **Lovable** for rapid MVP development.

The application architecture, database schema, AI verification workflow, fraud detection pipeline, campaign system, reward logic, wallet authentication, and backend functionality were extensively customized to implement the ProofFlow AI platform for the GenLayer ecosystem.

Lovable served as the development environment and rapid prototyping tool; the business logic and platform-specific functionality were implemented specifically for this project.

---

## Environment Variables

Create a `.env` file with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

---

## Local Development

```bash
git clone https://github.com/yourusername/proofflow-ai.git

cd proofflow-ai

npm install

npm run dev
```

---

## License

MIT License

---

## Built for

GenLayer Hackathon
