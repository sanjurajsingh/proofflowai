import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Wallet, Activity, CheckCircle2, XCircle, Clock, BarChart3, Droplets, Lock, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";
import { RequireWallet } from "@/components/RequireWallet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { shortDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { available, fundTreasury, getOrCreateTreasury } from "@/lib/treasury";

const gen = (n: number | string) => `${Number(n).toFixed(2)} GEN`;

export const Route = createFileRoute("/dashboard")({
  component: () => <RequireWallet><Dashboard /></RequireWallet>,
});

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  if (!user) return null;

  const { data: campaigns } = useQuery({
    queryKey: ["my-campaigns", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("*").eq("brand_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: treasury } = useQuery({
    queryKey: ["treasury", user.id],
    queryFn: async () => getOrCreateTreasury(user.id),
  });

  const { data: mySubs } = useQuery({
    queryKey: ["my-subs", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions").select("*, campaigns(title, reward_amount)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  const { data: brandMetrics } = useQuery({
    queryKey: ["brand-metrics", user.id],
    enabled: !!campaigns?.length,
    queryFn: async () => {
      const ids = campaigns!.map((c) => c.id);
      const { data: subs } = await supabase
        .from("submissions").select("status, reward_paid, user_id, campaign_id").in("campaign_id", ids);
      const total = subs?.length ?? 0;
      const approved = subs?.filter((s) => s.status === "approved" || s.status === "paid").length ?? 0;
      const rejected = subs?.filter((s) => s.status === "rejected").length ?? 0;
      const spent = subs?.reduce((a, s) => a + Number(s.reward_paid ?? 0), 0) ?? 0;
      const cpa = approved > 0 ? spent / approved : 0;
      const approvalRate = total > 0 ? (approved / total) * 100 : 0;
      const fraudRate = total > 0 ? (rejected / total) * 100 : 0;
      const byUser = new Map<string, number>();
      subs?.filter((s) => s.status === "approved" || s.status === "paid").forEach((s) => {
        byUser.set(s.user_id, (byUser.get(s.user_id) ?? 0) + 1);
      });
      const topUserIds = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      const { data: topProfiles } = topUserIds.length
        ? await supabase.from("profiles").select("id, display_name, trust_score").in("id", topUserIds.map((x) => x[0]))
        : { data: [] };
      const top = topUserIds.map(([id, count]) => ({
        id, count,
        profile: topProfiles?.find((p) => p.id === id),
      }));
      return { total, approved, rejected, spent, cpa, approvalRate, fraudRate, top };
    },
  });

  const totalBudget = campaigns?.reduce((a, c) => a + Number(c.total_budget), 0) ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Welcome back</h1>
            <p className="mt-1 text-muted-foreground">{profile?.display_name ?? "Anonymous worker"}</p>
          </div>
          <Link to="/campaigns/new">
            <Button variant="hero" size="lg"><Plus className="h-4 w-4" />New campaign</Button>
          </Link>
        </div>

        {/* Treasury card */}
        <section className="mb-8">
          <div className="glass rounded-2xl border-primary/40 p-6 shadow-glow">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Wallet className="h-4 w-4" /> Campaign Treasury . GenLayer testnet
                </div>
                <div className="mt-2 font-display text-4xl font-bold text-gradient">
                  {treasury ? gen(available(treasury)) : "0.00 GEN"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">Available . {treasury ? gen(treasury.reserved_balance) : "0.00 GEN"} reserved . {treasury ? gen(treasury.treasury_balance) : "0.00 GEN"} total</div>
              </div>
              <FundTreasuryDialog brandId={user.id} onFunded={() => qc.invalidateQueries({ queryKey: ["treasury", user.id] })} />
            </div>
          </div>
        </section>

        {brandMetrics && brandMetrics.total > 0 && (
          <div className="mb-10 grid gap-4 md:grid-cols-4">
            <StatCard icon={CheckCircle2} label="Approval rate" value={`${brandMetrics.approvalRate.toFixed(1)}%`} />
            <StatCard icon={XCircle} label="Fraud rate" value={`${brandMetrics.fraudRate.toFixed(1)}%`} />
            <StatCard icon={TrendingUp} label="Cost per approval" value={gen(brandMetrics.cpa)} />
            <StatCard icon={BarChart3} label="Total budget" value={gen(totalBudget)} />
          </div>
        )}

        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">My campaigns</h2>
          {!campaigns?.length ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-muted-foreground">No campaigns yet. Fund your treasury and launch one.</p>
              <Link to="/campaigns/new"><Button variant="hero" className="mt-4">Launch your first campaign</Button></Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {campaigns.map((c) => {
                const pct = (Number(c.spent_budget) / Math.max(Number(c.total_budget), 1)) * 100;
                return (
                  <Link key={c.id} to="/campaigns/$id" params={{ id: c.id }} className="group">
                    <div className="glass rounded-2xl p-5 transition-all hover:border-primary/40 hover:shadow-glow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">{c.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                        </div>
                        <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize shrink-0">{c.status.replace("_", " ")}</Badge>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{gen(c.spent_budget)} of {gen(c.total_budget)}</span>
                          <span>{gen(c.reward_amount)} per proof</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {brandMetrics && brandMetrics.top.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold">Top workers</h2>
            <div className="glass divide-y divide-border/50 overflow-hidden rounded-2xl">
              {brandMetrics.top.map((w) => (
                <Link key={w.id} to="/u/$id" params={{ id: w.id }} className="flex items-center justify-between p-4 hover:bg-muted/30">
                  <div>
                    <div className="font-medium">{w.profile?.display_name ?? "Anonymous worker"}</div>
                    <div className="text-xs text-muted-foreground">Trust score {w.profile?.trust_score ?? 50}/100</div>
                  </div>
                  <Badge variant="secondary">{w.count} approved</Badge>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-2xl font-bold">My submissions</h2>
          {!mySubs?.length ? (
            <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
              <p>You haven't submitted to any tasks yet.</p>
              <Link to="/marketplace"><Button variant="outline" className="mt-4">Browse marketplace</Button></Link>
            </div>
          ) : (
            <div className="glass divide-y divide-border/50 overflow-hidden rounded-2xl">
              {mySubs.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.campaigns?.title}</div>
                    <div className="text-xs text-muted-foreground">{shortDate(s.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-primary">{gen(s.campaigns?.reward_amount ?? 0)}</span>
                    <SubStatus status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function FundTreasuryDialog({ brandId, onFunded }: { brandId: string; onFunded: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const n = parseFloat(amount);
      if (!n || n <= 0) throw new Error("Enter a positive amount");
      await fundTreasury(brandId, n);
      toast.success(`Funded ${n.toFixed(2)} GEN`);
      setOpen(false);
      onFunded();
    } catch (e: any) {
      toast.error(e?.message ?? "Funding failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero"><Droplets className="h-4 w-4" />Fund treasury</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fund campaign treasury</DialogTitle>
          <DialogDescription>
            Simulates a GenLayer testnet deposit into your campaign treasury. Use the{" "}
            <a className="text-primary underline" href="https://testnet-faucet.genlayer.foundation/" target="_blank" rel="noreferrer">
              testnet faucet
            </a>{" "}
            first if your wallet has no GEN.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Amount (GEN)</Label>
            <Input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="submit" variant="hero" disabled={busy}>
              {busy ? "Funding..." : `Deposit ${amount} GEN`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function SubStatus({ status }: { status: string }) {
  const map: Record<string, { icon: any; cls: string; label: string }> = {
    pending: { icon: Clock, cls: "bg-muted text-muted-foreground", label: "Pending" },
    ai_reviewing: { icon: Activity, cls: "bg-accent/20 text-accent", label: "AI reviewing" },
    approved: { icon: CheckCircle2, cls: "bg-success/20 text-success", label: "Claimable" },
    rejected: { icon: XCircle, cls: "bg-destructive/20 text-destructive", label: "Rejected" },
    paid: { icon: CheckCircle2, cls: "bg-primary/20 text-primary", label: "Paid" },
    queued: { icon: Lock, cls: "bg-muted text-muted-foreground", label: "Queued" },
  };
  const m = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${m.cls}`}>
      <m.icon className="h-3 w-3" />{m.label}
    </span>
  );
}
