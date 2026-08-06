# ProofFlowAI → native GenLayer migration plan

Goal: verification and reward accounting become an **Intelligent Contract** (Python, GenVM) whose AI judgement is settled by the **Equivalence Principle**. Supabase stays only as the media/metadata/analytics layer. No Solidity, no Remix, no simulated chain logic.

## 1. Architecture after migration

```text
Browser (React + TanStack Start)
  ├── genlayer-js client (injected wallet)  ──►  ProofFlow Intelligent Contract (Python / GenVM)
  │                                                • campaigns + budgets (source of truth)
  │                                                • submissions + AI verdicts
  │                                                • worker balances + trust scores
  │                                                • payout requests
  └── Supabase  ──► private `proofs` image storage, signed URLs,
                    profile bio/avatar, cached analytics, fingerprints
```

The contract's non-deterministic block fetches the proof (`gl.nondet.web.get` / `render` for URLs, `gl.nondet.exec_prompt` for judgement) and each validator re-derives the verdict, so `ANTHROPIC_API_KEY` and the server-side AI path disappear — the LLM call moves inside consensus.

## 2. Supabase functions → Intelligent Contract

| Today (server fn / table) | Moves to contract as |
| --- | --- |
| `submit.functions.ts` (eligibility, cooldown, per-user cap, capacity, dedupe hash) | `@gl.public.write submit_proof(campaign_id, proof_url, proof_text, image_cid)` — all gates become deterministic pre-checks before the nondet block |
| `ai.server.ts` + `process-submission.functions.ts` (Anthropic scoring, approve/reject/review) | nondet leader function + validator via `gl.eq_principle.prompt_comparative` (score fields compared with a tolerance principle, free-text feedback ignored) |
| Wallet crediting, `wallet_transactions`, `spent_budget` update | deterministic state mutation after consensus: `balances: TreeMap[Address, u256]`, `campaigns[id].spent`, append-only `DynArray` ledger |
| `treasury.ts` (fund / reserve / spend) | `@gl.public.write.payable fund_campaign(campaign_id)` with real native GEN value; reserve/spend become internal accounting |
| `campaigns.new.tsx` inserts + `campaigns` review rules | `create_campaign(...)` storing title, reward, budget, caps, thresholds, keyword/domain rules |
| `moderate.functions.ts` (brand/admin override) | `moderate(submission_id, approve, reason)` guarded by `campaign.owner == gl.message.sender_address` |
| `payout.functions.ts` | `request_payout(amount)` + `settle_payout(id)`; final version transfers native GEN, MVP marks state |
| `user_roles` / `has_role` RLS | contract-level owner/admin address checks (no RLS equivalent needed) |
| trust score arithmetic in `process-submission` | `trust: TreeMap[Address, u32]` updated in the same write |

Storage typing rules to respect: no bare `int` (`u256`/`u32`/`bigint`), `DynArray` not `list`, `TreeMap` not `dict`, `@allow_storage @dataclass` for Campaign/Submission records, and `gl.storage.copy_to_memory` before passing records into a nondet block.

## 3. What stays in Supabase

- **Proof images** in the private `proofs` bucket + `getSignedProofUrl` — the contract stores only a content hash/path (on-chain writes are expensive; `exec_prompt` accepts at most 2 images).
- **Off-chain profile fields**: avatar, bio, display name.
- **`submission_fingerprints`** (IP / UA / device) — privacy-sensitive, must not go on-chain.
- **Analytics cache** (`analytics.functions.ts`, `byDay`, rejection-reason rollups) — read models mirrored from contract events, since aggregation queries on-chain are impractical.
- Tables that become mirrors/read-caches only (no longer authoritative): `campaigns`, `submissions`, `profiles.wallet_balance`, `wallet_transactions`, `payout_requests`, `campaign_treasuries`.
- Supabase **auth is dropped from the critical path**: wallet address becomes identity. A thin anonymous session is kept only so storage RLS keeps working for uploads.

## 4. Frontend pages: what changes

| Page | New data source |
| --- | --- |
| `marketplace.tsx` | `readContract('list_campaigns')` (Supabase only for cover images) |
| `campaigns.$id.tsx` | campaign + submissions via `readContract`; submit via `writeContract('submit_proof')` then `waitForTransactionReceipt` — needs new UI for `PROPOSING → COMMITTING → REVEALING → ACCEPTED/FINALIZED/UNDETERMINED` |
| `campaigns.new.tsx` | image upload stays Supabase; creation is `writeContract('create_campaign')` |
| `faucet.tsx` | replace simulated funding with `writeContract('fund_campaign', value)` and link the real testnet faucet (`testnet-faucet.genlayer.foundation`) |
| `payouts.tsx` | balances, ledger and payout requests from contract reads; `request_payout` write |
| `dashboard.tsx` | brand campaigns/submissions from contract; `moderate` write |
| `admin.tsx` | contract admin writes; fingerprint review stays Supabase |
| `analytics.tsx` | unchanged (Supabase read model) |
| `u.$id.tsx`, `settings.tsx` | trust/earnings from contract; bio/avatar from Supabase |
| `RequireWallet` / `useAuth` | wallet address becomes the identity; drop role checks based on `user_roles` |

## 5. Packages, tooling, env

Install:
- `genlayer-js` (frontend client, Viem-based) — replaces direct `wagmi` contract usage for GenLayer calls; keep `wagmi`/RainbowKit only for wallet connection UI.
- `genlayer` CLI (global, Node ≥18) — `genlayer init` / `up` / `deploy` / `network`.
- Python dev tooling: `genlayer-test` (`gltest`), `genvm-linter` (`genvm-lint`), optional `genlayer-test[sim]` for `glsim`.

New folder `contracts/proofflow.py` with the required version pragma header, plus deploy scripts for the non-scalar constructor args.

Networks: Studionet for iteration, then `testnet-bradbury` / `testnet-asimov` (chain id 4221, RPC `rpc-bradbury.genlayer.com`) — matches the chain id already in `src/lib/wagmi.ts`, but the RPC URL must be repointed. Client: `createClient({ chain: studionet, account })` + `await client.connect("studionet")` before any write.

Env: `ANTHROPIC_API_KEY` is **removed** (LLM inference happens inside GenVM validators). New public vars: `VITE_GENLAYER_NETWORK`, `VITE_PROOFFLOW_CONTRACT_ADDRESS`. No private keys anywhere.

## 6. Equivalence Principle design for verification

- Leader: fetch proof URL (`gl.nondet.web.get`/`render`), then `gl.nondet.exec_prompt(..., response_format='json')` returning `{relevance, quality, spam, confidence, recommendation}`.
- Validators: re-run the same function; agreement judged by `prompt_comparative` with a principle allowing ±1–2 on numeric scores while requiring an identical `recommendation`, and ignoring free-text feedback. Never `strict_eq` on LLM output.
- Schema-shape-only validation is explicitly insecure and will not be used — validators re-derive from the same source proof.
- `UNDETERMINED` transactions leave state unchanged; the UI must surface a retry path.

## 7. Suggested phasing

1. Write + lint the contract, unit-test with `gltest`, deploy to Studionet.
2. Add a `src/lib/genlayer/` client + typed read/write wrappers behind a feature flag.
3. Cut over pages in order: marketplace → campaign detail/submit → payouts → dashboard/admin.
4. Add a contract→Supabase indexer for the analytics read model.
5. Deploy to testnet Bradbury, delete `ai.server.ts`, `submit`/`process-submission`/`moderate`/`payout`/`treasury` server code.

### Notable risks
- Verification latency moves from ~seconds (single API call) to consensus rounds; submission UX must become async.
- Anti-fraud signals (IP/device) can't inform on-chain decisions; keep them as an off-chain admin flag only.
- On-chain storage cost means only hashes and structured verdicts get persisted, never raw proof text/images.
