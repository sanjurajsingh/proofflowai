import { supabase } from "@/integrations/supabase/client";

export async function getOrCreateTreasury(brandId: string) {
  const { data: existing } = await supabase
    .from("campaign_treasuries")
    .select("*")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from("campaign_treasuries")
    .insert({ brand_id: brandId, treasury_balance: 0, reserved_balance: 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fundTreasury(brandId: string, amount: number, txHash?: string) {
  const t = await getOrCreateTreasury(brandId);
  const next = Number(t.treasury_balance) + amount;
  const { error } = await supabase
    .from("campaign_treasuries")
    .update({ treasury_balance: next })
    .eq("id", t.id);
  if (error) throw error;
  await supabase.from("treasury_transactions").insert({
    treasury_id: t.id,
    brand_id: brandId,
    kind: "fund",
    amount,
    tx_hash: txHash ?? simulatedTxHash(),
    note: "Funded from GenLayer testnet faucet",
  });
  return next;
}

export async function reserveForCampaign(
  brandId: string,
  campaignId: string,
  amount: number,
) {
  const t = await getOrCreateTreasury(brandId);
  const available = Number(t.treasury_balance) - Number(t.reserved_balance);
  if (available < amount) {
    throw new Error(
      `Insufficient treasury. Available ${available.toFixed(2)} GEN, need ${amount.toFixed(2)} GEN. Fund treasury first.`,
    );
  }
  const { error } = await supabase
    .from("campaign_treasuries")
    .update({ reserved_balance: Number(t.reserved_balance) + amount })
    .eq("id", t.id);
  if (error) throw error;
  await supabase.from("treasury_transactions").insert({
    treasury_id: t.id,
    brand_id: brandId,
    campaign_id: campaignId,
    kind: "reserve",
    amount,
    note: "Reserved for campaign",
  });
}

export async function spendForSubmission(
  brandId: string,
  campaignId: string,
  submissionId: string,
  amount: number,
) {
  const t = await getOrCreateTreasury(brandId);
  const { error } = await supabase
    .from("campaign_treasuries")
    .update({
      treasury_balance: Number(t.treasury_balance) - amount,
      reserved_balance: Math.max(0, Number(t.reserved_balance) - amount),
    })
    .eq("id", t.id);
  if (error) throw error;
  await supabase.from("treasury_transactions").insert({
    treasury_id: t.id,
    brand_id: brandId,
    campaign_id: campaignId,
    submission_id: submissionId,
    kind: "spend",
    amount,
    note: "Paid out to worker",
  });
}

export function simulatedTxHash() {
  const hex = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 64; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

export function available(t: { treasury_balance: number | string; reserved_balance: number | string }) {
  return Number(t.treasury_balance) - Number(t.reserved_balance);
}
