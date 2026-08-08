import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CheckCircle2,
  ShieldAlert,
  Coins,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { Header } from "@/components/Header";
import { RequireWallet } from "@/components/RequireWallet";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/hooks/useWallet";
import {
  chainDate,
  fromWei,
  getBrandCampaigns,
  getBrandSubmissions,
  qk,
} from "@/lib/genlayer/proofflow";

const gen = (n: number) => `${n.toFixed(2)} GEN`;

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Campaign analytics — ProofFlow" },
      {
        name: "description",
        content:
          "Approval rate, spam signals, payouts and cost per verified proof, computed entirely from GenLayer contract state.",
      },
      { property: "og:title", content: "Campaign analytics — ProofFlow" },
      {
        property: "og:description",
        content: "Onchain campaign performance metrics derived from contract reads only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireWallet>
      <Analytics />
    </RequireWallet>
  ),
});

function Analytics() {
  const { address } = useWallet();

  const campaignsQ = useQuery({
    queryKey: qk.brandCampaigns(address ?? ""),
    queryFn: () => getBrandCampaigns(address as string),
    enabled: !!address,
  });

  const subsQ = useQuery({
    queryKey: qk.brandSubmissions(address ?? ""),
    queryFn: () => getBrandSubmissions(address as string),
    enabled: !!address,
  });

  const isLoading = campaignsQ.isLoading || subsQ.isLoading;
  const isError = campaignsQ.isError || subsQ.isError;

  const campaigns = campaignsQ.data ?? [];
  const subs = subsQ.data ?? [];

  const total = subs.length;
  const approved = subs.filter((s) => s.status === "approved").length;
  const rejected = subs.filter((s) => s.status === "rejected").length;
  const review = subs.filter((s) => s.status === "review").length;
  const spammy = subs.filter((s) => s.spam >= 60).length;
  const paid = subs.reduce((a, s) => a + fromWei(s.reward_paid), 0);
  const funded = campaigns.reduce((a, c) => a + fromWei(c.funded), 0);
  const spent = campaigns.reduce((a, c) => a + fromWei(c.spent), 0);

  const byDay = (() => {
    const days = new Map<string, { submissions: number; approved: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.set(d.toISOString().slice(0, 10), { submissions: 0, approved: 0 });
    }
    for (const s of subs) {
      const b = days.get(chainDate(s.created_at).toISOString().slice(0, 10));
      if (!b) continue;
      b.submissions++;
      if (s.status === "approved") b.approved++;
    }
    return [...days.entries()].map(([day, v]) => ({ day, ...v }));
  })();
  const maxBar = Math.max(1, ...byDay.map((d) => d.submissions));

  const perCampaign = campaigns
    .map((c) => {
      const rows = subs.filter((s) => s.campaign_id === c.id);
      const ok = rows.filter((s) => s.status === "approved").length;
      return {
        id: c.id,
        title: c.title,
        submissions: rows.length,
        approved: ok,
        approvalRate: rows.length ? (ok / rows.length) * 100 : null,
        paid: rows.reduce((a, s) => a + fromWei(s.reward_paid), 0),
        remaining: Math.max(0, fromWei(c.funded) - fromWei(c.spent)),
        active: c.active,
      };
    })
    .sort((a, b) => b.submissions - a.submissions);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Every figure is derived from contract reads —{" "}
              <code className="font-mono text-xs">get_brand_campaigns()</code> and{" "}
              <code className="font-mono text-xs">get_brand_submissions()</code>. Nothing is
              estimated.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass h-28 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="glass rounded-2xl border-destructive/40 p-12 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <h2 className="mt-3 text-lg font-semibold">Contract reads failed</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {(campaignsQ.error as Error)?.message ??
                (subsQ.error as Error)?.message ??
                "The GenLayer RPC did not respond."}
            </p>
          </div>
        ) : !campaigns.length ? (
          <div className="glass rounded-2xl p-16 text-center text-muted-foreground">
            You don't own any campaigns onchain yet, so there is nothing to measure.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-5">
              <Stat
                icon={CheckCircle2}
                label="Approval rate"
                value={total ? `${((approved / total) * 100).toFixed(1)}%` : "No submissions yet"}
                accent={!!total}
              />
              <Stat
                icon={ShieldAlert}
                label="High spam score"
                value={total ? `${((spammy / total) * 100).toFixed(1)}%` : "No submissions yet"}
              />
              <Stat icon={Coins} label="Paid to workers" value={gen(paid)} />
              <Stat
                icon={TrendingUp}
                label="Cost / verified proof"
                value={approved ? gen(paid / approved) : "No approvals yet"}
              />
              <Stat icon={BarChart3} label="Escrow remaining" value={gen(Math.max(0, funded - spent))} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Pill label="Approved" value={approved} cls="bg-success/10 text-success border-success/30" />
              <Pill label="In review" value={review} cls="bg-accent/10 text-accent border-accent/30" />
              <Pill
                label="Rejected"
                value={rejected}
                cls="bg-destructive/10 text-destructive border-destructive/30"
              />
            </div>

            <div className="glass rounded-2xl p-6">
              <h2 className="mb-4 text-lg font-bold">Submissions, last 14 days</h2>
              {!total ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No submissions recorded onchain yet.
                </p>
              ) : (
                <>
                  <div className="flex h-40 items-end gap-2">
                    {byDay.map((d) => (
                      <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                        <div className="relative flex h-full w-full items-end">
                          <div
                            className="absolute bottom-0 w-full rounded-t bg-muted"
                            style={{ height: `${(d.submissions / maxBar) * 100}%` }}
                          />
                          <div
                            className="absolute bottom-0 w-full rounded-t bg-primary shadow-glow"
                            style={{ height: `${(d.approved / maxBar) * 100}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{d.day.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded bg-primary" /> Approved
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded bg-muted" /> All submissions
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="glass overflow-hidden rounded-2xl">
              <h2 className="border-b border-border/50 p-5 text-lg font-bold">Per campaign</h2>
              <div className="divide-y divide-border/50">
                {perCampaign.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{c.title}</span>
                        <Badge variant={c.active ? "default" : "secondary"}>
                          {c.active ? "active" : "paused"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {c.submissions} submission{c.submissions === 1 ? "" : "s"} · {c.approved}{" "}
                        approved · {gen(c.remaining)} escrow left
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold">
                        {c.approvalRate === null ? "—" : `${c.approvalRate.toFixed(0)}%`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.approvalRate === null ? "no data yet" : `${gen(c.paid)} paid`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Rejection reasons, per-worker fraud clustering and time-to-verification are not stored
              as structured fields by the contract, so they are intentionally not shown.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`glass rounded-2xl p-5 ${accent ? "border-primary/40 shadow-glow" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div
        className={`mt-2 font-display text-2xl font-bold ${accent ? "text-gradient" : ""}`}
      >
        {value}
      </div>
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
