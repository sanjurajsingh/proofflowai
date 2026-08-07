/**
 * ProofFlow Intelligent Contract service layer.
 *
 * Every business-logic read/write goes through here using the official
 * genlayer-js SDK. Supabase is only used for proof image storage / metadata.
 */
import { formatEther, parseEther } from "viem";
import { readMethod, writeMethod } from "./client";

export type Address = `0x${string}`;

export interface ChainCampaign {
  id: number;
  owner: string;
  title: string;
  description: string;
  instructions: string;
  proof_type: string;
  category: string;
  cover_image_path: string;
  reward: string;
  budget: string;
  funded: string;
  spent: string;
  max_per_user: number;
  cooldown_seconds: number;
  min_trust: number;
  min_text_length: number;
  required_keywords: string;
  active: boolean;
  created_at: number;
}

export interface ChainSubmission {
  id: number;
  campaign_id: number;
  worker: string;
  proof_url: string;
  proof_text: string;
  image_path: string;
  content_hash: string;
  status: "approved" | "rejected" | "review" | string;
  relevance: number;
  quality: number;
  spam: number;
  confidence: number;
  feedback: string;
  reward_paid: string;
  created_at: number;
  reviewed_at: number;
}

export interface ChainWorker {
  address: string;
  balance: string;
  total_earned: string;
  trust: number;
  approved: number;
  submissions: number;
}

export interface ChainLedgerEntry {
  id: number;
  kind: string;
  amount: string;
  balance_after: string;
  submission_id: number;
  note: string;
  created_at: number;
}

export interface ChainPayout {
  id: number;
  worker: string;
  amount: string;
  destination: string;
  status: string;
  note: string;
  created_at: number;
}

export interface ChainStats {
  campaigns: number;
  submissions: number;
  approved: number;
  rejected: number;
  review: number;
  total_paid: string;
}

/* ------------------------------------------------------------------ units */

/** GEN (human string/number) → wei bigint used by the contract. */
export const toWei = (gen: string | number) => parseEther(String(gen || 0));
/** wei string from the contract → GEN number for display. */
export const fromWei = (wei: string | bigint | undefined | null) =>
  wei === undefined || wei === null || wei === "" ? 0 : Number(formatEther(BigInt(wei)));
export const genLabel = (wei: string | bigint | undefined | null, digits = 2) =>
  `${fromWei(wei).toFixed(digits)} GEN`;
/** Contract timestamps are unix seconds. */
export const chainDate = (seconds: number) => new Date((seconds || 0) * 1000);

export const sameAddress = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/* ------------------------------------------------------------------ reads */

export const getCampaigns = () => readMethod<ChainCampaign[]>("get_campaigns");
export const getCampaign = (id: number) => readMethod<ChainCampaign>("get_campaign", [id]);
export const getBrandCampaigns = (owner: string) =>
  readMethod<ChainCampaign[]>("get_brand_campaigns", [owner]);
export const getCampaignSubmissions = (id: number) =>
  readMethod<ChainSubmission[]>("get_campaign_submissions", [id]);
export const getWorkerSubmissions = (worker: string) =>
  readMethod<ChainSubmission[]>("get_worker_submissions", [worker]);
export const getBrandSubmissions = (owner: string) =>
  readMethod<ChainSubmission[]>("get_brand_submissions", [owner]);
export const getWorker = (worker: string) => readMethod<ChainWorker>("get_worker", [worker]);
export const getLedger = (worker: string) => readMethod<ChainLedgerEntry[]>("get_ledger", [worker]);
export const getPayouts = (worker: string) => readMethod<ChainPayout[]>("get_payouts", [worker]);
export const getPendingPayouts = () => readMethod<ChainPayout[]>("get_pending_payouts");
export const getAdmin = () => readMethod<string>("get_admin");
export const getStats = () => readMethod<ChainStats>("get_stats");

/* ----------------------------------------------------------------- writes */

export interface CreateCampaignInput {
  title: string;
  description: string;
  instructions: string;
  proof_type: string;
  category: string;
  cover_image_path: string;
  /** GEN per approved submission */
  reward: string | number;
  /** total GEN budget */
  budget: string | number;
  max_per_user: number;
  cooldown_seconds: number;
  min_trust: number;
  min_text_length: number;
  required_keywords: string[];
}

export async function createCampaign(account: Address, input: CreateCampaignInput) {
  const { receipt } = await writeMethod(account, "create_campaign", [
    input.title,
    input.description,
    input.instructions,
    input.proof_type,
    input.category,
    input.cover_image_path,
    toWei(input.reward),
    toWei(input.budget),
    input.max_per_user,
    input.cooldown_seconds,
    input.min_trust,
    input.min_text_length,
    input.required_keywords.join(","),
  ]);
  return { campaignId: readReturn<number>(receipt), receipt };
}

export async function fundCampaign(account: Address, campaignId: number, gen: string | number) {
  return writeMethod(account, "fund_campaign", [campaignId], { value: toWei(gen) });
}

export async function setCampaignActive(account: Address, campaignId: number, active: boolean) {
  return writeMethod(account, "set_campaign_active", [campaignId, active]);
}

export interface SubmitProofInput {
  campaignId: number;
  proofUrl: string;
  proofText: string;
  imagePath: string;
  contentHash: string;
}

export async function submitProof(account: Address, input: SubmitProofInput) {
  const { receipt } = await writeMethod(account, "submit_proof", [
    input.campaignId,
    input.proofUrl,
    input.proofText,
    input.imagePath,
    input.contentHash,
  ]);
  return { submissionId: readReturn<number>(receipt), receipt };
}

export const moderate = (account: Address, submissionId: number, approve: boolean, reason: string) =>
  writeMethod(account, "moderate", [submissionId, approve, reason]);

/** Claim earned rewards to the caller's own wallet. `gen` omitted → full balance. */
export const claimReward = (account: Address, gen?: string | number) =>
  writeMethod(account, "claim_reward", [gen === undefined ? BigInt(0) : toWei(gen)]);

export const requestPayout = (account: Address, gen: string | number, destination: string) =>
  writeMethod(account, "request_payout", [toWei(gen), destination]);

export const settlePayout = (
  account: Address,
  payoutId: number,
  approve: boolean,
  note: string,
) => writeMethod(account, "settle_payout", [payoutId, approve, note]);

/* --------------------------------------------------------------- receipts */

/** Best-effort extraction of a write method's return value from the receipt. */
export function readReturn<T>(receipt: unknown): T | null {
  const r = receipt as Record<string, any> | null;
  const candidates = [
    r?.["result"],
    r?.["returnValue"],
    r?.["return_value"],
    r?.["consensus_data"]?.leader_receipt?.[0]?.result,
    r?.["consensusData"]?.leaderReceipt?.[0]?.result,
  ];
  for (const c of candidates) {
    if (typeof c === "number" || typeof c === "string" || typeof c === "boolean") return c as T;
    if (c && typeof c === "object" && "value" in c) return (c as any).value as T;
  }
  return null;
}

/** Content hash used for duplicate detection inside the contract. */
export async function contentHash(parts: (string | undefined | null)[]) {
  const text = parts.filter(Boolean).join("|").trim().toLowerCase();
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ------------------------------------------------------------ query keys */

export const qk = {
  campaigns: ["gl", "campaigns"] as const,
  campaign: (id: number) => ["gl", "campaign", id] as const,
  brandCampaigns: (owner?: string) => ["gl", "brand-campaigns", owner ?? ""] as const,
  campaignSubmissions: (id: number) => ["gl", "campaign-submissions", id] as const,
  workerSubmissions: (w?: string) => ["gl", "worker-submissions", w ?? ""] as const,
  brandSubmissions: (w?: string) => ["gl", "brand-submissions", w ?? ""] as const,
  worker: (w?: string) => ["gl", "worker", w ?? ""] as const,
  ledger: (w?: string) => ["gl", "ledger", w ?? ""] as const,
  payouts: (w?: string) => ["gl", "payouts", w ?? ""] as const,
  pendingPayouts: ["gl", "pending-payouts"] as const,
  admin: ["gl", "admin"] as const,
  stats: ["gl", "stats"] as const,
};
