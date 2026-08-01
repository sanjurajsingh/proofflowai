import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
import { supabaseAdmin } from "../integrations/supabase/client.server";
import { hashContent, deviceFingerprint } from "./fraud.server";
import { processSubmission } from "./process-submission.functions";

const schema = z.object({
  campaignId: z.string().uuid(),
  proofText: z.string().max(5000).optional().nullable(),
  proofUrl: z.string().url().max(2000).optional().nullable(),
  proofImagePath: z.string().max(500).optional().nullable(), // storage path, NOT public URL
});

export const submitProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const sb = supabaseAdmin;

    // Load profile + campaign
    const [{ data: profile }, { data: campaign }] = await Promise.all([
      sb.from("profiles").select("trust_score, total_submissions").eq("id", userId).single(),
      sb.from("campaigns").select("*").eq("id", data.campaignId).single(),
    ]);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status !== "active") throw new Error("Campaign is not active");

    // Trust gate
    if ((profile?.trust_score ?? 50) < (campaign.min_trust_score ?? 0)) {
      throw new Error(`Trust score too low for this campaign (need ${campaign.min_trust_score})`);
    }

    // Cooldown
    const { data: recent } = await sb
      .from("submissions")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) {
      const elapsed = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
      if (elapsed < (campaign.cooldown_seconds ?? 60)) {
        throw new Error(`Please wait ${Math.ceil((campaign.cooldown_seconds ?? 60) - elapsed)}s before submitting again`);
      }
    }

    // Max per user / campaign (counts non-rejected)
    const { count: existing } = await sb
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", data.campaignId)
      .eq("user_id", userId)
      .neq("status", "rejected");
    if ((existing ?? 0) >= (campaign.max_per_user ?? 1)) {
      throw new Error("You've reached the submission limit for this campaign");
    }

    // Capacity check
    const slotsLeft = Math.floor(
      (Number(campaign.total_budget) - Number(campaign.spent_budget)) / Number(campaign.reward_amount),
    );
    if (slotsLeft <= 0) throw new Error("Campaign is full");

    // Content hash for duplicate detection
    const imageBasename = data.proofImagePath ? data.proofImagePath.split("/").pop() ?? "" : "";
    const contentHash = hashContent([data.proofText, data.proofUrl, imageBasename]) || null;

    // Build proof_image_url as the storage path (NOT a public URL — bucket is private)
    const proofImagePath = data.proofImagePath ?? null;

    const { data: inserted, error: insErr } = await sb.from("submissions").insert({
      campaign_id: data.campaignId,
      user_id: userId,
      proof_text: data.proofText ?? null,
      proof_url: data.proofUrl ?? null,
      proof_image_url: proofImagePath,
      content_hash: contentHash,
      status: "queued",
    }).select().single();

    if (insErr) {
      if (insErr.code === "23505") throw new Error("This proof was already submitted to this campaign");
      throw new Error(insErr.message);
    }

    // Fingerprint
    const ua = getRequestHeader("user-agent") ?? null;
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    await sb.from("submission_fingerprints").insert({
      submission_id: inserted.id,
      user_id: userId,
      ip_address: ip,
      user_agent: ua,
      device_hash: deviceFingerprint(ua, ip),
      email: null,
    });

    // Bump submission counter
    await sb.from("profiles").update({
      total_submissions: (profile?.total_submissions ?? 0) + 1,
    }).eq("id", userId);

    // Process the queued submission. We await to guarantee completion in the
    // serverless worker (fire-and-forget can be cancelled). The DB still records
    // the queued → ai_reviewing → final status transitions for observability.
    try {
      await processSubmission({ data: { submissionId: inserted.id } });
    } catch (e) {
      console.error("processSubmission failed:", e);
    }

    return { id: inserted.id, status: "queued" as const };
  });
