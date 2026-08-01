import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, TrendingUp, ShieldCheck, Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { RequireWallet } from "@/components/RequireWallet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { shortDate } from "@/lib/format";
import { requestPayout } from "@/lib/payout.functions";

const gen = (n: number | string) => `${Number(n).toFixed(2)} GEN`;

export const Route = createFileRoute("/payouts")({
  head: () => ({
    meta: [
      { title: "Wallet & Rewards — ProofFlow" },
      {
        name: "description",
        content:
          "Track your ProofFlow reward balance, wallet transactions and payout requests from AI-verified submissions.",
      },
      { property: "og:title", content: "Wallet & Rewards — ProofFlow" },
      {
        property: "og:description",
        content: "Reward balance, transaction ledger and payout requests for verified proof-of-work.",
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
  const { user } = useAuth();
  const qc = useQueryClient();
  const submitPayout = useServerFn(requestPayout);
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!user) return null;

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  const { data: earnings } = useQuery({
    queryKey: ["earnings", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, campaign_id, status, reward_paid, created_at, campaigns(title, reward_amount)")
        .eq("user_id", user.id)
        .in("status", ["approved", "paid"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ledger } = useQuery({
    queryKey: ["wallet-ledger", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: payouts } = useQuery({
    queryKey: ["payout-requests", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const balance = Number(profile?.wallet_balance ?? 0);
  const trust = profile?.trust_score ?? 50;
  const totalEarned = Number(profile?.total_earned ?? 0);

  const onRequestPayout = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    if (amt > balance) return toast.error("Amount exceeds your balance");
    if (!destination.trim()) return toast.error("Enter a payout destination");
    setSubmitting(true);
    try {
      await submitPayout({ data: { amount: amt, destination: destination.trim() } });
      toast.success(`Payout requested for ${gen(amt)}`, {
        description: "An admin will review and settle it.",
      });
      setAmount("");
      setDestination("");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      qc.invalidateQueries({ queryKey: ["wallet-ledger", user.id] });
      qc.invalidateQueries({ queryKey: ["payout-requests", user.id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Payout request failed");
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
            Approved submissions credit your reward balance automatically. Request a payout any time.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass rounded-2xl border-primary/40 p-6 shadow-glow">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Coins className="h-4 w-4" />
              Reward balance
            </div>
            <div className="mt-2 text-3xl font-bold text-gradient">{gen(balance)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {earnings?.length ?? 0} approved submission{earnings?.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Total earned
            </div>
            <div className="mt-2 text-3xl font-bold">{gen(totalEarned)}</div>
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
            Request a payout
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Minimum 5 GEN. Payouts are settled manually by an admin during this MVP.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
            <Input
              type="number"
              min={5}
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input
              placeholder="Destination (wallet address, email, handle)"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
            <Button variant="hero" disabled={submitting || balance <= 0} onClick={onRequestPayout}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Requesting
                </>
              ) : (
                "Request payout"
              )}
            </Button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">Earned rewards</h2>
          {!earnings?.length ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              No approved submissions yet. Browse the marketplace to earn.
            </div>
          ) : (
            <div className="glass divide-y divide-border/50 overflow-hidden rounded-2xl">
              {earnings.map((s: any) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.campaigns?.title}</div>
                    <div className="text-xs text-muted-foreground">{shortDate(s.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold">
                      {gen(s.reward_paid ?? s.campaigns?.reward_amount ?? 0)}
                    </span>
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
                      {shortDate(t.created_at)}
                      {t.note ? ` · ${t.note}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-mono font-semibold ${Number(t.amount) < 0 ? "text-destructive" : "text-primary"}`}
                    >
                      {Number(t.amount) < 0 ? "" : "+"}
                      {gen(t.amount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Balance {gen(t.balance_after)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">Payout requests</h2>
          {!payouts?.length ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
              No payout requests yet
            </div>
          ) : (
            <div className="glass divide-y divide-border/50 overflow-hidden rounded-2xl">
              {payouts.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="font-mono text-sm">{gen(p.amount)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {shortDate(p.created_at)} · {p.destination ?? "—"}
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
