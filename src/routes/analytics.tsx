import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, ShieldAlert, DollarSign, TrendingUp } from "lucide-react";
import { Header } from "@/components/Header";
import { RequireWallet } from "@/components/RequireWallet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";

type AnalyticsData = {
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
};

export const Route = createFileRoute("/analytics")({
  component: () => <RequireWallet><Analytics /></RequireWallet>,
});

function Analytics() {
  const { user } = useAuth();
  if (!user) return null;

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", user.id],
    queryFn: async () => {
      const { data: campaigns } = await supabase.from("campaigns").select("id").eq("brand_id", user.id);
      const campaignIds = (campaigns ?? []).map((c) => c.id);
      const { data: ownedSubs } = campaignIds.length
        ? await supabase.from("submissions").select("status, ai_spam_score, rejection_reason, reward_paid, created_at").in("campaign_id", campaignIds)
        : { data: [] };
      const list = ownedSubs ?? [];
      const approved = list.filter((s) => s.status === "approved" || s.status === "paid").length;
      const rejected = list.filter((s) => s.status === "rejected").length;
      const pending = list.filter((s) => ["pending", "queued", "ai_reviewing"].includes(s.status)).length;
      const total = list.length;
      const fraudish = list.filter((s) => (s.ai_spam_score ?? 0) >= 60).length;
      const totalPayouts = list.reduce((a, s) => a + Number(s.reward_paid ?? 0), 0);
      const days = new Map<string, { submissions: number; approved: number }>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        days.set(d.toISOString().slice(0, 10), { submissions: 0, approved: 0 });
      }
      for (const s of list) {
        const bucket = days.get(new Date(s.created_at).toISOString().slice(0, 10));
        if (!bucket) continue;
        bucket.submissions++;
        if (s.status === "approved" || s.status === "paid") bucket.approved++;
      }
      const result: AnalyticsData = {
        totalSubmissions: total,
        approved,
        rejected,
        pending,
        approvalRate: total ? Math.round((approved / total) * 1000) / 10 : 0,
        fraudRate: total ? Math.round((fraudish / total) * 1000) / 10 : 0,
        totalPayouts,
        costPerVerified: approved ? Math.round((totalPayouts / approved) * 100) / 100 : 0,
        topRejections: [],
        byDay: [...days.entries()].map(([day, v]) => ({ day, ...v })),
      };
      return result;
    },
  });

  const maxBar = Math.max(1, ...(data?.byDay.map((d) => d.submissions) ?? [0]));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-sm text-muted-foreground">Performance and fraud signals across your campaigns</p>
          </div>
        </div>

        {isLoading ? <div className="text-muted-foreground">Loading...</div> : !data ? null : (
          <>
            <div className="grid gap-4 md:grid-cols-5">
              <Stat icon={CheckCircle2} label="Approval rate" value={`${data.approvalRate}%`} accent />
              <Stat icon={ShieldAlert} label="Fraud rate" value={`${data.fraudRate}%`} />
              <Stat icon={DollarSign} label="Total payouts" value={money(data.totalPayouts)} />
              <Stat icon={TrendingUp} label="Cost / verified" value={money(data.costPerVerified)} />
              <Stat icon={BarChart3} label="Submissions" value={data.totalSubmissions.toString()} />
            </div>

            <div className="glass rounded-2xl p-6">
              <h2 className="mb-4 text-lg font-bold">Submissions, last 14 days</h2>
              <div className="flex h-40 items-end gap-2">
                {data.byDay.map((d) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                    <div className="relative flex h-full w-full items-end">
                      <div className="absolute bottom-0 w-full rounded-t bg-muted" style={{ height: `${(d.submissions / maxBar) * 100}%` }} />
                      <div className="absolute bottom-0 w-full rounded-t bg-primary shadow-glow" style={{ height: `${(d.approved / maxBar) * 100}%` }} />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{d.day.slice(5)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-primary" /> Approved</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-muted" /> Total submissions</span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Pill label="Approved" value={data.approved} cls="bg-success/10 text-success border-success/30" />
              <Pill label="Pending" value={data.pending} cls="bg-accent/10 text-accent border-accent/30" />
              <Pill label="Rejected" value={data.rejected} cls="bg-destructive/10 text-destructive border-destructive/30" />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-5 ${accent ? "border-primary/40 shadow-glow" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
      <div className={`mt-2 font-display text-2xl font-bold ${accent ? "text-gradient" : ""}`}>{value}</div>
    </div>
  );
}

function Pill({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-2xl border p-5 text-center ${cls}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-1 text-xs uppercase opacity-80">{label}</div>
    </div>
  );
}
