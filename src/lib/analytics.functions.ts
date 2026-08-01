import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
import { supabaseAdmin } from "../integrations/supabase/client.server";

export interface AnalyticsSummary {
  totalSubmissions: number;
  approved: number;
  rejected: number;
  pending: number;
  approvalRate: number;
  fraudRate: number;
  totalPayouts: number;
  costPerVerified: number;
  topRejections: Array<{ reason: string; count: number }>;
  byDay: Array<{ day: string; submissions: number; approved: number }>;
}

/**
 * Returns platform-wide analytics for admins, or scoped to the brand's campaigns.
 */
export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AnalyticsSummary> => {
    const sb = supabaseAdmin;
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = !!roles?.some((r) => r.role === "admin");

    let campaignIds: string[] | null = null;
    if (!isAdmin) {
      const { data: cs } = await sb.from("campaigns").select("id").eq("brand_id", context.userId);
      campaignIds = (cs ?? []).map((c) => c.id);
      if (campaignIds.length === 0) {
        return {
          totalSubmissions: 0, approved: 0, rejected: 0, pending: 0,
          approvalRate: 0, fraudRate: 0, totalPayouts: 0, costPerVerified: 0,
          topRejections: [], byDay: [],
        };
      }
    }

    let q = sb.from("submissions").select("status, ai_spam_score, rejection_reason, reward_paid, created_at");
    if (campaignIds) q = q.in("campaign_id", campaignIds);
    const { data: subs } = await q;
    const list = subs ?? [];

    const approved = list.filter((s) => s.status === "approved" || s.status === "paid").length;
    const rejected = list.filter((s) => s.status === "rejected").length;
    const pending = list.filter((s) => s.status === "pending" || s.status === "queued" || s.status === "ai_reviewing").length;
    const total = list.length;
    const fraudish = list.filter((s) => (s.ai_spam_score ?? 0) >= 60).length;
    const totalPayouts = list.reduce((a, s) => a + Number(s.reward_paid ?? 0), 0);

    // Top rejection reasons
    const reasonCounts = new Map<string, number>();
    for (const s of list) {
      if (s.status !== "rejected" || !s.rejection_reason) continue;
      const key = s.rejection_reason.slice(0, 80);
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
    const topRejections = [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count).slice(0, 5);

    // By-day for last 14 days
    const days = new Map<string, { submissions: number; approved: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.set(d.toISOString().slice(0, 10), { submissions: 0, approved: 0 });
    }
    for (const s of list) {
      const day = new Date(s.created_at).toISOString().slice(0, 10);
      const bucket = days.get(day);
      if (!bucket) continue;
      bucket.submissions++;
      if (s.status === "approved" || s.status === "paid") bucket.approved++;
    }

    return {
      totalSubmissions: total,
      approved, rejected, pending,
      approvalRate: total ? Math.round((approved / total) * 1000) / 10 : 0,
      fraudRate: total ? Math.round((fraudish / total) * 1000) / 10 : 0,
      totalPayouts,
      costPerVerified: approved ? Math.round((totalPayouts / approved) * 100) / 100 : 0,
      topRejections,
      byDay: [...days.entries()].map(([day, v]) => ({ day, ...v })),
    };
  });
