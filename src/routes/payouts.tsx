import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { Wallet, TrendingUp, ShieldCheck, Coins, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { keccak256, toBytes } from "viem";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { RequireWallet } from "@/components/RequireWallet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { shortDate } from "@/lib/format";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { simulatedTxHash, spendForSubmission } from "@/lib/treasury";
import { REWARD_VAULT_ABI, REWARD_VAULT_ADDRESS, REWARD_VAULT_DEPLOYED } from "@/lib/contracts/config";

const gen = (n: number | string) => `${Number(n).toFixed(2)} GEN`;
const EXPLORER = "https://zksync-os-testnet-genlayer.explorer.zksync.dev";

export const Route = createFileRoute("/payouts")({
  component: () => <RequireWallet><Payouts /></RequireWallet>,
});

function Payouts() {
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const qc = useQueryClient();
  const [claiming, setClaiming] = useState<string | null>(null);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  if (!user) return null;

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  const { data: claimable } = useQuery({
    queryKey: ["claimable", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, campaign_id, claim_status, tx_hash, claimed_at, status, created_at, campaigns(title, reward_amount, brand_id)")
        .eq("user_id", user.id)
        .in("status", ["approved", "paid"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: history } = useQuery({
    queryKey: ["claim-history", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("reward_claims").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const claim = async (sub: any) => {
    if (!address) return;
    setClaiming(sub.id);
    try {
      const amount = Number(sub.campaigns?.reward_amount ?? 0);
      await supabase.from("submissions").update({ claim_status: "claiming" }).eq("id", sub.id);

      // TESTNET ONLY — placeholder voucher metadata until RewardVault is deployed
      // and a server route is wired to sign EIP-712 vouchers with the operator key.
      const nonce = keccak256(toBytes(`${sub.id}:${Date.now()}:${Math.random()}`));
      const deadline = Math.floor(Date.now() / 1000) + 60 * 30;
      const voucher: any = {
        nonce,
        deadline,
        campaignId: "0x" as `0x${string}`,
        submissionId: "0x" as `0x${string}`,
        worker: address,
        amount: BigInt(Math.round(amount * 1e18)).toString(),
      };
      const signature = "0x" as `0x${string}`;
      const vaultDeployed = REWARD_VAULT_DEPLOYED;

      const { data: claimRow, error: cErr } = await supabase.from("reward_claims").insert({
        user_id: user.id,
        submission_id: sub.id,
        campaign_id: sub.campaign_id,
        amount,
        wallet_address: address,
        status: "claiming",
        voucher_nonce: voucher.nonce,
        voucher_deadline: Number(voucher.deadline),
        voucher_signature: signature,
        voucher_issued_at: new Date().toISOString(),
      }).select().single();
      if (cErr) throw cErr;

      // 2. Submit on-chain claim if vault deployed, otherwise simulate
      let txHash: string;
      if (vaultDeployed && REWARD_VAULT_DEPLOYED && REWARD_VAULT_ADDRESS) {
        const hash = await writeContractAsync({
          address: REWARD_VAULT_ADDRESS,
          abi: REWARD_VAULT_ABI,
          functionName: "claim",
          args: [
            voucher.campaignId,
            voucher.submissionId,
            voucher.worker,
            BigInt(voucher.amount),
            BigInt(voucher.deadline),
            voucher.nonce,
            signature,
          ],
        });
        txHash = hash;
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
      } else {
        await new Promise((r) => setTimeout(r, 1200));
        txHash = simulatedTxHash();
      }

      if (sub.campaigns?.brand_id) {
        try { await spendForSubmission(sub.campaigns.brand_id, sub.campaign_id, sub.id, amount); } catch {}
      }

      await Promise.all([
        supabase.from("reward_claims").update({
          status: "paid", tx_hash: txHash, settled_at: new Date().toISOString(),
        }).eq("id", claimRow.id),
        supabase.from("submissions").update({
          claim_status: "paid", tx_hash: txHash, status: "paid", claimed_at: new Date().toISOString(),
        }).eq("id", sub.id),
      ]);

      toast.success(`Claimed ${amount.toFixed(2)} GEN`, {
        description: vaultDeployed ? `On-chain tx ${txHash.slice(0, 12)}…` : `Simulated · ${txHash.slice(0, 12)}…`,
        action: { label: "View tx", onClick: () => window.open(`${EXPLORER}/tx/${txHash}`, "_blank") },
      });

      qc.invalidateQueries({ queryKey: ["claimable", user.id] });
      qc.invalidateQueries({ queryKey: ["claim-history", user.id] });
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (e: any) {
      await supabase.from("submissions").update({ claim_status: "failed" }).eq("id", sub.id);
      toast.error(e?.shortMessage ?? e?.message ?? "Claim failed");
    } finally {
      setClaiming(null);
    }
  };

  const trust = profile?.trust_score ?? 50;
  const totalEarned = Number(profile?.total_earned ?? 0);
  const pending = claimable?.filter((s) => s.status === "approved" && s.claim_status !== "paid") ?? [];
  const totalClaimable = pending.reduce((a, s) => a + Number(s.campaigns?.reward_amount ?? 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Wallet and rewards</h1>
          <p className="text-sm text-muted-foreground">Claim verified rewards onchain via GenLayer testnet.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass rounded-2xl border-primary/40 p-6 shadow-glow">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Coins className="h-4 w-4" />Claimable now</div>
            <div className="mt-2 text-3xl font-bold text-gradient">{gen(totalClaimable)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{pending.length} approved submission{pending.length === 1 ? "" : "s"}</div>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-4 w-4" />Total earned</div>
            <div className="mt-2 text-3xl font-bold">{gen(totalEarned)}</div>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />Trust score</div>
            <div className="mt-2 text-3xl font-bold">{trust}<span className="text-base text-muted-foreground">/100</span></div>
            <Progress value={trust} className="mt-2 h-1.5" />
          </div>
        </div>

        {!isConnected && (
          <div className="glass rounded-2xl border-amber-500/40 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4 text-amber-500" />Connect your wallet to claim</h3>
                <p className="text-sm text-muted-foreground">Rewards settle directly to your GenLayer testnet wallet.</p>
              </div>
              <ConnectWalletButton />
            </div>
          </div>
        )}

        <section>
          <h2 className="mb-3 text-xl font-bold">Claimable rewards</h2>
          {!claimable?.length ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              No approved submissions yet. Browse the marketplace to earn.
            </div>
          ) : (
            <div className="glass divide-y divide-border/50 overflow-hidden rounded-2xl">
              {claimable.map((s: any) => {
                const isPaid = s.claim_status === "paid" || s.status === "paid";
                const amt = Number(s.campaigns?.reward_amount ?? 0);
                return (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{s.campaigns?.title}</div>
                      <div className="text-xs text-muted-foreground">{shortDate(s.created_at)}</div>
                      {s.tx_hash && (
                        <a href={`${EXPLORER}/tx/${s.tx_hash}`} target="_blank" rel="noreferrer"
                           className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">
                          {s.tx_hash.slice(0, 14)}...{s.tx_hash.slice(-6)} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold">{gen(amt)}</span>
                      {isPaid ? (
                        <Badge>Paid</Badge>
                      ) : (
                        <Button size="sm" variant="hero"
                          disabled={!isConnected || claiming === s.id}
                          onClick={() => claim(s)}>
                          {claiming === s.id ? <><Loader2 className="h-4 w-4 animate-spin" />Claiming</> : "Claim"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">Payout history</h2>
          {!history?.length ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No claims yet</div>
          ) : (
            <div className="glass divide-y divide-border/50 overflow-hidden rounded-2xl">
              {history.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="font-mono text-sm">{gen(c.amount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {shortDate(c.created_at)} .{" "}
                      {c.tx_hash ? (
                        <a href={`${EXPLORER}/tx/${c.tx_hash}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {c.tx_hash.slice(0, 12)}...
                        </a>
                      ) : "Pending"}
                    </div>
                  </div>
                  <Badge variant={c.status === "paid" ? "default" : c.status === "failed" ? "destructive" : "secondary"} className="capitalize">{c.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
