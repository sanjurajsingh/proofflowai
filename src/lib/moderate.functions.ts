import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
import { supabaseAdmin } from "../integrations/supabase/client.server";

/**
 * Brand or admin moderates a single submission (manual override after AI).
 */
export const moderateSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      submissionId: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      reason: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = supabaseAdmin;
    const { data: sub, error } = await sb
      .from("submissions").select("*, campaigns(*)").eq("id", data.submissionId).single();
    if (error || !sub) throw new Error("Submission not found");
    const campaign: any = sub.campaigns;

    // Authorization: admin or brand owner of the campaign
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = !!roles?.some((r) => r.role === "admin");
    if (!isAdmin && campaign.brand_id !== context.userId) throw new Error("Forbidden");

    if (sub.status === "approved" || sub.status === "paid") {
      throw new Error("Submission already approved");
    }

    if (data.action === "reject") {
      await sb.from("submissions").update({
        status: "rejected",
        rejection_reason: data.reason ?? "Manually rejected",
        reviewed_at: new Date().toISOString(),
      }).eq("id", sub.id);
      return { status: "rejected" as const };
    }

    // Approve → ledger payout
    const reward = Number(campaign.reward_amount);
    const { data: cFresh } = await sb.from("campaigns").select("spent_budget,total_budget").eq("id", campaign.id).single();
    const newSpent = Number(cFresh?.spent_budget ?? 0) + reward;
    if (cFresh && newSpent > Number(cFresh.total_budget)) {
      throw new Error("Campaign budget exhausted");
    }
    await sb.from("campaigns").update({ spent_budget: newSpent }).eq("id", campaign.id);

    const { data: prof } = await sb
      .from("profiles").select("wallet_balance, trust_score, total_earned, approved_submissions")
      .eq("id", sub.user_id).single();
    const newBalance = Number(prof?.wallet_balance ?? 0) + reward;

    await sb.from("profiles").update({
      wallet_balance: newBalance,
      total_earned: Number(prof?.total_earned ?? 0) + reward,
      approved_submissions: Number(prof?.approved_submissions ?? 0) + 1,
      trust_score: Math.min(100, (prof?.trust_score ?? 50) + 1),
    }).eq("id", sub.user_id);

    await sb.from("submissions").update({
      status: "approved",
      reward_paid: reward,
      reviewed_at: new Date().toISOString(),
    }).eq("id", sub.id);

    await sb.from("wallet_transactions").insert({
      user_id: sub.user_id,
      kind: "earn",
      amount: reward,
      balance_after: newBalance,
      submission_id: sub.id,
      note: `Manually approved for "${campaign.title}"`,
    });

    return { status: "approved" as const };
  });
