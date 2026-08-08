import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Check, X, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { RequireWallet } from "@/components/RequireWallet";
import { NetworkNotice } from "@/components/NetworkNotice";
import { ProofImageLink } from "@/components/ProofImage";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/hooks/useWallet";
import {
  chainDate,
  genLabel,
  getAdmin,
  getCampaigns,
  getCampaignSubmissions,
  getPendingPayouts,
  moderate,
  qk,
  sameAddress,
  settlePayout,
  type Address,
  type ChainSubmission,
} from "@/lib/genlayer/proofflow";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin moderation — ProofFlow" },
      {
        name: "description",
        content:
          "Contract-admin console for ProofFlow: review submissions flagged by GenLayer consensus and settle worker payout requests onchain.",
      },
      { property: "og:title", content: "Admin moderation — ProofFlow" },
      {
        property: "og:description",
        content: "Moderate flagged proofs and settle payouts through the Intelligent Contract.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireWallet>
      <Admin />
    </RequireWallet>
  ),
});

function Admin() {
  const { address, canTransact } = useWallet();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const {
    data: admin,
    isLoading: adminLoading,
    isError: adminError,
    error,
  } = useQuery({ queryKey: qk.admin, queryFn: getAdmin, retry: 1 });

  const isAdmin = sameAddress(address, admin);

  const { data: campaigns } = useQuery({
    queryKey: qk.campaigns,
    queryFn: getCampaigns,
    enabled: isAdmin,
  });

  const {
    data: pending,
    isLoading: queueLoading,
    isError: queueError,
  } = useQuery({
    queryKey: ["gl", "review-queue", "admin"],
    enabled: isAdmin && !!campaigns,
    queryFn: async () => {
      const rows = (
        await Promise.all(campaigns!.map((c) => getCampaignSubmissions(c.id)))
      ).flat() as ChainSubmission[];
      return rows.filter((s) => s.status === "review").sort((a, b) => b.created_at - a.created_at);
    },
  });

  const { data: payouts, isLoading: payoutsLoading } = useQuery({
    queryKey: qk.pendingPayouts,
    enabled: isAdmin,
    queryFn: getPendingPayouts,
    select: (rows) => [...rows].sort((a, b) => b.created_at - a.created_at),
  });

  const campaignTitle = (id: number) =>
    campaigns?.find((c) => c.id === id)?.title ?? `Campaign #${id}`;
  const campaignReward = (id: number) => campaigns?.find((c) => c.id === id)?.reward ?? "0";

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    if (!canTransact) return toast.error("Switch your wallet to the GenLayer network first");
    setBusy(key);
    const t = toast.loading("Confirm in your wallet, then waiting for consensus…");
    try {
      await fn();
      toast.success(ok, { id: t });
      await qc.invalidateQueries({ queryKey: ["gl"] });
    } catch (e: any) {
      toast.error(e?.shortMessage ?? e?.message ?? "Transaction failed", { id: t });
    } finally {
      setBusy(null);
    }
  };

  if (adminLoading) {
    return (
      <Shell>
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
          Reading <code className="font-mono text-xs">get_admin()</code> from the contract…
        </div>
      </Shell>
    );
  }

  if (adminError) {
    return (
      <Shell>
        <div className="glass rounded-2xl border-destructive/40 p-12 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <h2 className="mt-3 text-lg font-semibold">Could not reach the contract</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {(error as Error)?.message ?? "get_admin() did not respond."}
          </p>
        </div>
      </Shell>
    );
  }

  if (!isAdmin) {
    return (
      <Shell>
        <div className="glass mx-auto max-w-lg rounded-2xl p-10 text-center">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-2xl font-bold">Admin wallet required</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            This console only accepts the wallet registered as admin inside the ProofFlow
            Intelligent Contract.
          </p>
          <dl className="mt-6 space-y-2 text-left text-xs">
            <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card/40 p-3">
              <dt className="text-muted-foreground">Contract admin</dt>
              <dd className="break-all font-mono">{admin || "—"}</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card/40 p-3">
              <dt className="text-muted-foreground">Connected wallet</dt>
              <dd className="break-all font-mono">{address}</dd>
            </div>
          </dl>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <NetworkNotice className="mb-6" />

      <section>
        <h2 className="mb-4 text-xl font-bold">Submission queue</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Proofs that GenLayer consensus routed to human review. Approving calls{" "}
          <code className="font-mono text-xs">moderate()</code> and credits the worker from campaign
          escrow.
        </p>
        {queueLoading ? (
          <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
            Loading queue from chain…
          </div>
        ) : queueError ? (
          <div className="glass rounded-2xl border-destructive/40 p-8 text-center text-sm text-destructive">
            Failed to load the review queue from the contract.
          </div>
        ) : !pending?.length ? (
          <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
            All clear — nothing flagged for review.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((s) => {
              const rowBusy = busy === `mod-${s.id}`;
              return (
                <div key={s.id} className="glass rounded-2xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{campaignTitle(s.campaign_id)}</h3>
                        <Badge variant="secondary">{genLabel(campaignReward(s.campaign_id))}</Badge>
                        <Badge variant="outline">manual review</Badge>
                      </div>
                      {s.feedback && (
                        <p className="text-sm text-muted-foreground">Consensus: "{s.feedback}"</p>
                      )}
                      {s.confidence > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          relevance {s.relevance} · quality {s.quality} · spam {s.spam} · confidence{" "}
                          {s.confidence}
                        </p>
                      )}
                      {s.proof_text && <p className="mt-2 text-sm italic">"{s.proof_text}"</p>}
                      {s.proof_url && (
                        <a
                          href={s.proof_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block break-all text-sm text-primary hover:underline"
                        >
                          {s.proof_url}
                        </a>
                      )}
                      {s.image_path && (
                        <div className="mt-1">
                          <ProofImageLink path={s.image_path} />
                        </div>
                      )}
                      <div className="mt-2 break-all text-xs text-muted-foreground">
                        {chainDate(s.created_at).toLocaleString()} · {s.worker}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!busy || !canTransact}
                        onClick={() =>
                          run(
                            `mod-${s.id}`,
                            () => moderate(address as Address, s.id, false, "Rejected by admin"),
                            "Rejected onchain",
                          )
                        }
                      >
                        {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="hero"
                        disabled={!!busy || !canTransact}
                        onClick={() =>
                          run(
                            `mod-${s.id}`,
                            () => moderate(address as Address, s.id, true, "Approved by admin"),
                            "Approved — reward credited onchain",
                          )
                        }
                      >
                        {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Payout requests</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Escrowed worker payout requests. Settling calls{" "}
          <code className="font-mono text-xs">settle_payout()</code> on the contract.
        </p>
        {payoutsLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-muted-foreground">Loading…</div>
        ) : !payouts?.length ? (
          <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
            No pending payout requests.
          </div>
        ) : (
          <div className="space-y-3">
            {payouts.map((p) => {
              const rowBusy = busy === `pay-${p.id}`;
              return (
                <div
                  key={p.id}
                  className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
                >
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {genLabel(p.amount)} to{" "}
                      <span className="break-all font-mono text-sm">{p.destination}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {chainDate(p.created_at).toLocaleString()} · {p.status}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy || !canTransact}
                      onClick={() =>
                        run(
                          `pay-${p.id}`,
                          () => settlePayout(address as Address, p.id, false, "Rejected by admin"),
                          "Payout rejected — balance returned",
                        )
                      }
                    >
                      {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="hero"
                      disabled={!!busy || !canTransact}
                      onClick={() =>
                        run(
                          `pay-${p.id}`,
                          () => settlePayout(address as Address, p.id, true, "Settled by admin"),
                          "Payout marked settled",
                        )
                      }
                    >
                      {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Mark paid
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Contract admin</h1>
            <p className="text-sm text-muted-foreground">
              Moderation and payout settlement, executed through the Intelligent Contract
            </p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
