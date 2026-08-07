import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Wallet, TrendingUp, ShieldCheck, Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { RequireWallet } from "@/components/RequireWallet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  chainDate,
  claimReward,
  fromWei,
  genLabel,
  getLedger,
  getPayouts,
  getWorker,
  getWorkerSubmissions,
  qk,
  type Address,
} from "@/lib/genlayer/proofflow";

export const Route = createFileRoute("/payouts")({
  head: () => ({
    meta: [
      { title: "Wallet & Rewards — ProofFlow" },
      {
        name: "description",
        content:
          "Track your onchain ProofFlow reward balance, ledger and reward claims from validator-verified submissions.",
      },
      { property: "og:title", content: "Wallet & Rewards — ProofFlow" },
      {
        property: "og:description",
        content: "Onchain reward balance, ledger and claims for verified proof-of-work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireWallet>
      <Payouts />
    </RequireWallet>
  ),
});

function Payouts() {
  const { address } = useAccount();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!address) return null;

  const { data: worker } = useQuery({
    queryKey: qk.worker(address),
    queryFn: () => getWorker(address),
  });

  const { data: earnings } = useQuery({
    queryKey: qk.workerSubmissions(address),
    queryFn: () => getWorkerSubmissions(address),
    select: (rows) =>
      rows.filter((s) => s.status === "approved").sort((a, b) => b.created_at - a.created_at),
  });

  const { data: ledger } = useQuery({
    queryKey: qk.ledger(address),
    queryFn: () => getLedger(address),
    select: (rows) => [...rows].sort((a, b) => b.created_at - a.created_at).slice(0, 50),
  });

  const { data: payouts } = useQuery({
    queryKey: qk.payouts(address),
    queryFn: () => getPayouts(address),
    select: (rows) => [...rows].sort((a, b) => b.created_at - a.created_at).slice(0, 50),
  });

  const balance = fromWei(worker?.balance);
  const trust = worker?.trust ?? 50;
  const totalEarned = fromWei(worker?.total_earned);

  const onClaim = async () => {
    const amt = amount.trim() === "" ? balance : Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    if (amt > balance) return toast.error("Amount exceeds your balance");
    setSubmitting(true);
    try {
      await claimReward(address as Address, amt);
      toast.success(`Claimed ${amt.toFixed(2)} GEN`, {
        description: "Recorded onchain against your wallet address.",
      });
      setAmount("");
      qc.invalidateQueries({ queryKey: ["gl"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Claim failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Wallet and rewards</h1>
          <p className="text-sm text-muted-foreground">
            Verified submissions credit your balance inside the Intelligent Contract. Claim to your
            connected wallet any time.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass rounded-2xl border-primary/40 p-6 shadow-glow">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Coins className="h-4 w-4" />
              Reward balance
            </div>
            <div className="mt-2 text-3xl font-bold text-gradient">{genLabel(worker?.balance)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {earnings?.length ?? 0} verified submission{earnings?.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Total earned
            </div>
            <div className="mt-2 text-3xl font-bold">{totalEarned.toFixed(2)} GEN</div>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Trust score
            </div>
            <div className="mt-2 text-3xl font-bold">
              {trust}
              <span className="text-base text-muted-foreground">/100</span>
            </div>
            <Progress value={trust} className="mt-2 h-1.5" />
          </div>
        </div>

        <section className="glass rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Wallet className="h-4 w-4 text-primary" />
            Claim rewards
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Claims call <code className="font-mono text-xs">claim_reward()</code> on the contract and
            settle to <span className="font-mono text-xs">{address}</span>.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder={`Amount (leave empty for full ${balance.toFixed(2)} GEN)`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button variant="hero" disabled={submitting || balance <= 0} onClick={onClaim}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Awaiting consensus
                </>
              ) : (
                "Claim reward"
              )}
            </Button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">Earned rewards</h2>
          {!earnings?.length ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              No verified submissions yet. Browse the marketplace to earn.
            </div>
          ) : (
            <div className="glass divide-y divide-border/50 overflow-hidden rounded-2xl">
              {earnings.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">Campaign #{s.campaign_id}</div>
                    <div className="text-xs text-muted-foreground">
                      {chainDate(s.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold">{genLabel(s.reward_paid)}</span>
                    <Badge>Credited</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">Transactions</h2>
          {!ledger?.length ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
              No transactions yet
            </div>
          ) : (
            <div className="glass divide-y divide-border/50 overflow-hidden rounded-2xl">
              {ledger.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="font-medium capitalize">{t.kind}</div>
                    <div className="text-xs text-muted-foreground">
                      {chainDate(t.created_at).toLocaleDateString()}
                      {t.note ? ` · ${t.note}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-mono font-semibold ${
                        t.kind === "claim" || t.kind === "payout" ? "text-destructive" : "text-primary"
                      }`}
                    >
                      {t.kind === "claim" || t.kind === "payout" ? "-" : "+"}
                      {genLabel(t.amount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Balance {genLabel(t.balance_after)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">Claims and payouts</h2>
          {!payouts?.length ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
              No claims yet
            </div>
          ) : (
            <div className="glass divide-y divide-border/50 overflow-hidden rounded-2xl">
              {payouts.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="font-mono text-sm">{genLabel(p.amount)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {chainDate(p.created_at).toLocaleDateString()} · {p.destination || "—"}
                    </div>
                  </div>
                  <Badge
                    variant={
                      p.status === "paid"
                        ? "default"
                        : p.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                    className="capitalize"
                  >
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
