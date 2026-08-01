import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "../integrations/supabase/client.server";
import { runAiValidation } from "./ai.server";

const inputSchema = z.object({ submissionId: z.string().uuid() });

/**
 * Worker that drains a queued submission: runs AI, updates status, credits wallet.
 * Idempotent: re-running on the same id is safe — does nothing if already reviewed.
 */
export const processSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = supabaseAdmin;
    const { data: sub, error: subErr } = await sb
      .from("submissions")
      .select("*, campaigns(*)")
      .eq("id", data.submissionId)
      .single();
    if (subErr || !sub) throw new Error("Submission not found");
    if (sub.status !== "queued" && sub.status !== "ai_reviewing") {
      return { status: sub.status, alreadyProcessed: true };
    }

    const campaign: any = sub.campaigns;
    if (!campaign) throw new Error("Campaign missing");

    // Mark as reviewing
    await sb.from("submissions").update({ status: "ai_reviewing" }).eq("id", sub.id);

    // Worker trust score
    const { data: prof } = await sb
      .from("profiles")
      .select("wallet_balance, trust_score, total_earned, approved_submissions")
      .eq("id", sub.user_id)
      .single();
    const trust = prof?.trust_score ?? 50;

    const ai = await runAiValidation({
      campaignTitle: campaign.title,
      campaignDescription: campaign.description,
      instructions: campaign.instructions,
      proofType: campaign.proof_type,
      proofText: sub.proof_text,
      proofUrl: sub.proof_url,
      hasImage: !!sub.proof_image_url,
      trustScore: trust,
    });

    // Trust-aware decision: high trust auto-approves "review"; very low trust forces review
    let finalStatus: "approved" | "rejected" | "pending" =
      ai.recommendation === "approve" ? "approved"
        : ai.recommendation === "reject" ? "rejected"
        : "pending";
    if (ai.recommendation === "review" && trust >= 75 && ai.spam < 25 && ai.confidence >= 60) {
      finalStatus = "approved";
    }
    if (finalStatus === "approved" && trust < 25) {
      finalStatus = "pending"; // require manual review for new accounts
    }

    const updates: any = {
      status: finalStatus,
      ai_relevance_score: Math.round(ai.relevance),
      ai_quality_score: Math.round(ai.quality),
      ai_spam_score: Math.round(ai.spam),
      ai_confidence_score: Math.round(ai.confidence),
      ai_feedback: ai.feedback,
      reviewed_at: new Date().toISOString(),
    };
    if (finalStatus === "rejected") updates.rejection_reason = ai.feedback;
    if (finalStatus === "approved") updates.reward_paid = campaign.reward_amount;

    await sb.from("submissions").update(updates).eq("id", sub.id);

    // Wallet + budget movement (server-side only, ledgered)
    if (finalStatus === "approved") {
      const reward = Number(campaign.reward_amount);

      const { data: cFresh } = await sb.from("campaigns").select("spent_budget,total_budget").eq("id", campaign.id).single();
      const newSpent = Number(cFresh?.spent_budget ?? 0) + reward;
      if (cFresh && newSpent > Number(cFresh.total_budget)) {
        // Out of budget — flip to pending instead of paying
        await sb.from("submissions").update({ status: "pending", rejection_reason: null }).eq("id", sub.id);
        return { status: "pending", reason: "campaign_budget_exceeded" };
      }
      await sb.from("campaigns").update({ spent_budget: newSpent }).eq("id", campaign.id);

      const newBalance = Number(prof?.wallet_balance ?? 0) + reward;
      await sb.from("profiles").update({
        wallet_balance: newBalance,
        total_earned: Number(prof?.total_earned ?? 0) + reward,
        approved_submissions: Number(prof?.approved_submissions ?? 0) + 1,
        trust_score: Math.min(100, trust + 1),
      }).eq("id", sub.user_id);

      await sb.from("wallet_transactions").insert({
        user_id: sub.user_id,
        kind: "earn",
        amount: reward,
        balance_after: newBalance,
        submission_id: sub.id,
        note: `Reward for "${campaign.title}"`,
      });
    } else if (finalStatus === "rejected") {
      // Penalize trust slightly
      await sb.from("profiles").update({
        trust_score: Math.max(0, trust - 2),
      }).eq("id", sub.user_id);
    }

    return { status: finalStatus, ai };
  });
