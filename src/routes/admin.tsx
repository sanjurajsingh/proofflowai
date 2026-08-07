import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Shield, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { RequireWallet } from "@/components/RequireWallet";
import { ProofImageLink } from "@/components/ProofImage";
import { Badge } from "@/components/ui/badge";
import {
  chainDate,
  genLabel,
  getAdmin,
  getBrandSubmissions,
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
  component: () => <RequireWallet><Admin /></RequireWallet>,
});

function Admin() {
  const { address } = useAccount();
  const qc = useQueryClient();

  const { data: admin } = useQuery({ queryKey: qk.admin, queryFn: getAdmin });
  const isAdmin = sameAddress(address, admin);

  const { data: campaigns } = useQuery({ queryKey: qk.campaigns, queryFn: getCampaigns });
  const owned = campaigns?.filter((c) => sameAddress(address, c.owner)) ?? [];
  const canReview = isAdmin || owned.length > 0;

  const { data: pending } = useQuery({
    queryKey: ["gl", "review-queue", address ?? "", isAdmin],
    enabled: !!address && !!campaigns && canReview,
    queryFn: async () => {
      const rows: ChainSubmission[] = isAdmin
        ? (await Promise.all(campaigns!.map((c) => getCampaignSubmissions(c.id)))).flat()
        : await getBrandSubmissions(address as string);
      return rows.filter((s) => s.status === "review").sort((a, b) => b.created_at - a.created_at);
    },
  });

  const { data: payouts } = useQuery({
    queryKey: qk.pendingPayouts,
    enabled: isAdmin,
    queryFn: getPendingPayouts,
    select: (rows) => [...rows].sort((a, b) => b.created_at - a.created_at),
  });

  const campaignTitle = (id: number) => campaigns?.find((c) => c.id === id)?.title ?? `Campaign #${id}`;
  const campaignReward = (id: number) => campaigns?.find((c) => c.id === id)?.reward ?? "0";

  const onModerate = async (sub: ChainSubmission, approve: boolean) => {
    try {
      await moderate(address as Address, sub.id, approve, approve ? "Approved by reviewer" : "Rejected by reviewer");
      toast.success(approve ? "Approved. Reward credited onchain" : "Rejected");
      qc.invalidateQueries({ queryKey: ["gl"] });
    } catch (e: any) { toast.error(e?.message ?? "Action failed"); }
  };

  const onPayout = async (id: number, approve: boolean) => {
    try {
      await settlePayout(address as Address, id, approve, approve ? "Settled" : "Rejected");
      toast.success(approve ? "Marked settled" : "Rejected");
      qc.invalidateQueries({ queryKey: ["gl"] });
    } catch (e: any) { toast.error(e?.message ?? "Action failed"); }
  };

  if (!address) return null;
  if (!canReview) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md p-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">Reviewers only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Only the contract admin or a campaign owner can moderate submissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-10">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Moderation</h1>
            <p className="text-sm text-muted-foreground">
              Submissions the validator network flagged for human review{isAdmin ? " and pending claims" : ""}
            </p>
          </div>
        </div>

        <section>
          <h2 className="mb-4 text-xl font-bold">Submission queue</h2>
          {!pending?.length ? (
            <div className="glass rounded-2xl p-12 text-center text-muted-foreground">All clear.</div>
          ) : (
            <div className="space-y-3">
              {pending.map((s) => (
                <div key={s.id} className="glass rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{campaignTitle(s.campaign_id)}</h3>
                        <Badge variant="secondary">{genLabel(campaignReward(s.campaign_id))}</Badge>
                        <Badge variant="outline">manual review</Badge>
                      </div>
                      {s.feedback && <p className="text-sm text-muted-foreground">AI: "{s.feedback}"</p>}
                      {s.proof_text && <p className="mt-2 text-sm italic">"{s.proof_text}"</p>}
                      {s.proof_url && <a href={s.proof_url} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-primary hover:underline">{s.proof_url}</a>}
                      {s.image_path && <div className="mt-1"><ProofImageLink path={s.image_path} /></div>}
                      <div className="mt-2 text-xs text-muted-foreground">
                        {chainDate(s.created_at).toLocaleString()} · {s.worker}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => onModerate(s, false)}><X className="h-4 w-4" />Reject</Button>
                      <Button size="sm" variant="hero" onClick={() => onModerate(s, true)}><Check className="h-4 w-4" />Approve</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {isAdmin && (
          <section>
            <h2 className="mb-4 text-xl font-bold">Reward claims</h2>
            {!payouts?.length ? (
              <div className="glass rounded-2xl p-8 text-center text-muted-foreground">No pending claims.</div>
            ) : (
              <div className="space-y-3">
                {payouts.map((p) => (
                  <div key={p.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {genLabel(p.amount)} to <span className="font-mono text-sm">{p.destination}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {chainDate(p.created_at).toLocaleString()} · {p.status}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => onPayout(p.id, false)}><X className="h-4 w-4" />Reject</Button>
                      <Button size="sm" variant="hero" onClick={() => onPayout(p.id, true)}><Check className="h-4 w-4" />Mark paid</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
