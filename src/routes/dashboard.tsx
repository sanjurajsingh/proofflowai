import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { NetworkNotice } from "@/components/NetworkNotice";
import { Plus, Wallet, CheckCircle2, XCircle, Clock, BarChart3, Droplets, Hourglass, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";
import { RequireWallet } from "@/components/RequireWallet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  chainDate,
  fromWei,
  fundCampaign,
  genLabel,
  getBrandCampaigns,
  getBrandSubmissions,
  getWorker,
  getWorkerSubmissions,
  qk,
  type Address,
} from "@/lib/genlayer/proofflow";
import { FAUCET_URL } from "@/lib/genlayer/config";

const gen = (n: number) => `${n.toFixed(2)} GEN`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your ProofFlow dashboard — campaigns, proofs, rewards" },
      {
        name: "description",
        content:
          "Track the campaigns you fund, the proofs you submit and your GEN reward balance, all read from the GenLayer Intelligent Contract.",
      },
      { property: "og:title", content: "Your ProofFlow dashboard" },
      {
        property: "og:description",
        content: "Onchain campaigns, submissions and reward balance in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <RequireWallet><Dashboard /></RequireWallet>,
});

function Dashboard() {
  const { address, canTransact } = useWallet();
  const qc = useQueryClient();
  if (!address) return null;

  const { data: campaigns } = useQuery({
    queryKey: qk.brandCampaigns(address),
    queryFn: () => getBrandCampaigns(address),
    select: (rows) => [...rows].sort((a, b) => b.created_at - a.created_at),
  });

  const { data: worker } = useQuery({
    queryKey: qk.worker(address),
    queryFn: () => getWorker(address),
  });

  const { data: mySubs } = useQuery({
    queryKey: qk.workerSubmissions(address),
    queryFn: () => getWorkerSubmissions(address),
    select: (rows) => [...rows].sort((a, b) => b.created_at - a.created_at).slice(0, 10),
  });

  const { data: brandSubs } = useQuery({
    queryKey: qk.brandSubmissions(address),
    queryFn: () => getBrandSubmissions(address),
    enabled: !!campaigns?.length,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gl"] });

  const totalBudget = campaigns?.reduce((a, c) => a + fromWei(c.budget), 0) ?? 0;
  const totalFunded = campaigns?.reduce((a, c) => a + fromWei(c.funded), 0) ?? 0;
  const totalSpent = campaigns?.reduce((a, c) => a + fromWei(c.spent), 0) ?? 0;

  const brandMetrics = (() => {
    if (!brandSubs?.length) return null;
    const total = brandSubs.length;
    const approved = brandSubs.filter((s) => s.status === "approved").length;
    const rejected = brandSubs.filter((s) => s.status === "rejected").length;
    const spent = brandSubs.reduce((a, s) => a + fromWei(s.reward_paid), 0);
    const byWorker = new Map<string, number>();
    brandSubs
      .filter((s) => s.status === "approved")
      .forEach((s) => byWorker.set(s.worker, (byWorker.get(s.worker) ?? 0) + 1));
    return {
      total,
      approved,
      rejected,
      cpa: approved > 0 ? spent / approved : 0,
      approvalRate: (approved / total) * 100,
      fraudRate: (rejected / total) * 100,
      top: [...byWorker.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  })();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Welcome back</h1>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{short(address)}</p>
          </div>
          <Link to="/campaigns/new">
            <Button variant="hero" size="lg"><Plus className="h-4 w-4" />New campaign</Button>
          </Link>
        </div>

        {/* Onchain campaign funding */}
        <section className="mb-8">
          <div className="glass rounded-2xl border-primary/40 p-6 shadow-glow">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Wallet className="h-4 w-4" /> Campaign funding . GenLayer Intelligent Contract
                </div>
                <div className="mt-2 font-display text-4xl font-bold text-gradient">
                  {gen(Math.max(0, totalFunded - totalSpent))}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Unspent onchain . {gen(totalSpent)} paid to workers . {gen(totalBudget)} planned budget
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Your reward balance</div>
                <div className="mt-1 font-display text-2xl font-bold">{genLabel(worker?.balance)}</div>
                <div className="text-xs text-muted-foreground">Trust {worker?.trust ?? 50}/100</div>
              </div>
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
              <p className="text-muted-foreground">No campaigns yet. Create one and fund it onchain.</p>
              <Link to="/campaigns/new"><Button variant="hero" className="mt-4">Launch your first campaign</Button></Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {campaigns.map((c) => {
                const funded = fromWei(c.funded);
                const spent = fromWei(c.spent);
                const pct = (spent / Math.max(funded, 0.000001)) * 100;
                return (
                  <div key={c.id} className="glass rounded-2xl p-5 transition-all hover:border-primary/40">
                    <Link to="/campaigns/$id" params={{ id: String(c.id) }} className="group block">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold group-hover:text-primary">{c.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                        </div>
                        <Badge variant={c.active ? "default" : "secondary"} className="capitalize shrink-0">
                          {c.active ? "active" : funded > 0 ? "paused" : "unfunded"}
                        </Badge>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{gen(spent)} of {gen(funded)} funded</span>
                          <span>{genLabel(c.reward)} per proof</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    </Link>
                    <div className="mt-4 flex justify-end">
                      <FundCampaignDialog
                        account={address as Address}
                        campaignId={c.id}
                        title={c.title}
                        suggested={Math.max(fromWei(c.budget) - funded, fromWei(c.reward))}
                        onFunded={invalidate}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {brandMetrics && brandMetrics.top.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold">Top workers</h2>
            <div className="glass divide-y divide-border/50 overflow-hidden rounded-2xl">
              {brandMetrics.top.map(([addr, count]) => (
                <Link key={addr} to="/u/$id" params={{ id: addr }} className="flex items-center justify-between p-4 hover:bg-muted/30">
                  <div className="font-mono text-sm">{short(addr)}</div>
                  <Badge variant="secondary">{count} approved</Badge>
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
                    <Link to="/campaigns/$id" params={{ id: String(s.campaign_id) }} className="truncate font-medium hover:text-primary">
                      Campaign #{s.campaign_id}
                    </Link>
                    <div className="text-xs text-muted-foreground">{chainDate(s.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-primary">{genLabel(s.reward_paid)}</span>
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

function FundCampaignDialog({
  account, campaignId, title, suggested, onFunded,
}: {
  account: Address; campaignId: number; title: string; suggested: number; onFunded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(suggested > 0 ? suggested.toFixed(2) : "10");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const n = parseFloat(amount);
      if (!n || n <= 0) throw new Error("Enter a positive amount");
      await fundCampaign(account, campaignId, n);
      toast.success(`Funded ${n.toFixed(2)} GEN onchain`);
      setOpen(false);
      onFunded();
    } catch (e: any) {
      toast.error(e?.message ?? "Funding failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Droplets className="h-4 w-4" />Fund campaign</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fund "{title}"</DialogTitle>
          <DialogDescription>
            Sends GEN with a <code className="font-mono text-xs">fund_campaign()</code> transaction to the
            Intelligent Contract. Top up from the{" "}
            <a className="text-primary underline" href={FAUCET_URL} target="_blank" rel="noreferrer">
              testnet faucet
            </a>{" "}
            if your wallet has no GEN.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Amount (GEN)</Label>
            <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="submit" variant="hero" disabled={busy}>
              {busy ? "Awaiting consensus..." : `Deposit ${amount} GEN`}
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
    review: { icon: Hourglass, cls: "bg-accent/20 text-accent", label: "Manual review" },
    approved: { icon: CheckCircle2, cls: "bg-success/20 text-success", label: "Credited" },
    rejected: { icon: XCircle, cls: "bg-destructive/20 text-destructive", label: "Rejected" },
  };
  const m = map[status] ?? { icon: Clock, cls: "bg-muted text-muted-foreground", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${m.cls}`}>
      <m.icon className="h-3 w-3" />{m.label}
    </span>
  );
}
