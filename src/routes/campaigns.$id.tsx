import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { ArrowLeft, Hexagon, Upload, CheckCircle2, XCircle, Activity, Clock, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Header } from "@/components/Header";
import { ProofImageLink } from "@/components/ProofImage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  chainDate,
  contentHash,
  fromWei,
  genLabel,
  getCampaign,
  getCampaignSubmissions,
  getWorkerSubmissions,
  qk,
  sameAddress,
  submitProof,
  type Address,
  type ChainSubmission,
} from "@/lib/genlayer/proofflow";

export const Route = createFileRoute("/campaigns/$id")({
  component: CampaignDetail,
});

function CampaignDetail() {
  const { id } = Route.useParams();
  const campaignId = Number(id);
  const nav = useNavigate();
  const { user } = useAuth();
  const { address } = useAccount();
  const qc = useQueryClient();

  const [proofText, setProofText] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: campaign, isLoading } = useQuery({
    queryKey: qk.campaign(campaignId),
    queryFn: () => getCampaign(campaignId),
    enabled: Number.isFinite(campaignId),
  });

  const isOwner = sameAddress(address, campaign?.owner);

  const { data: submissions } = useQuery({
    queryKey: [...qk.campaignSubmissions(campaignId), address ?? "", isOwner],
    enabled: !!campaign && !!address,
    queryFn: async () => {
      if (isOwner) return getCampaignSubmissions(campaignId);
      const mine = await getWorkerSubmissions(address as string);
      return mine.filter((s) => s.campaign_id === campaignId);
    },
    select: (rows) => [...rows].sort((a, b) => b.created_at - a.created_at),
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !campaign) return;
    setSubmitting(true);
    try {
      // Supabase is used for proof image storage only.
      let imagePath = "";
      if (file) {
        const path = `${(user?.id ?? address).toLowerCase()}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("proofs").upload(path, file);
        if (upErr) throw upErr;
        imagePath = path;
      }
      const hash = await contentHash([proofUrl, proofText, imagePath]);
      await submitProof(address as Address, {
        campaignId,
        proofUrl,
        proofText,
        imagePath,
        contentHash: hash,
      });
      toast.success("Proof verified onchain by the validator network.");
      setProofText(""); setProofUrl(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["gl"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-background"><Header /><div className="p-10 text-center text-muted-foreground">Loading...</div></div>;
  if (!campaign) return <div className="min-h-screen bg-background"><Header /><div className="p-10 text-center">Campaign not found</div></div>;

  const funded = fromWei(campaign.funded);
  const spent = fromWei(campaign.spent);
  const reward = fromWei(campaign.reward);
  const pct = funded > 0 ? (spent / funded) * 100 : 0;
  const slots = reward > 0 ? Math.floor((funded - spent) / reward) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/marketplace" })} className="mb-4">
          <ArrowLeft className="h-4 w-4" />Back
        </Button>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="glass rounded-2xl p-6">
              <div className="mb-3 flex items-center gap-2">
                <Badge className="capitalize">{campaign.proof_type}</Badge>
                {campaign.category && <Badge variant="secondary">{campaign.category}</Badge>}
                <Badge variant={campaign.active ? "default" : "secondary"} className="capitalize">
                  {campaign.active ? "active" : "inactive"}
                </Badge>
              </div>
              <h1 className="text-3xl font-bold">{campaign.title}</h1>
              <p className="mt-3 whitespace-pre-line text-muted-foreground">{campaign.description}</p>
              {campaign.instructions && (
                <div className="mt-5 rounded-xl border border-border/60 bg-card/40 p-4">
                  <div className="mb-1 text-xs font-semibold uppercase text-primary">Instructions</div>
                  <p className="whitespace-pre-line text-sm">{campaign.instructions}</p>
                </div>
              )}
            </div>

            {address && !isOwner && campaign.active && slots > 0 && (
              <form onSubmit={onSubmit} className="glass rounded-2xl p-6">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Hexagon className="h-5 w-5 text-primary" />Submit your proof</h2>
                {(campaign.proof_type === "link" || campaign.proof_type === "screenshot") && (
                  <div className="mb-4">
                    <Label>{campaign.proof_type === "link" ? "URL" : "Reference URL (optional)"}</Label>
                    <Input type="url" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="https://..." required={campaign.proof_type === "link"} />
                  </div>
                )}
                {(campaign.proof_type === "screenshot" || campaign.proof_type === "image") && (
                  <div className="mb-4">
                    <Label>Upload {campaign.proof_type}</Label>
                    <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 p-6 hover:border-primary/60">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">{file ? file.name : "Click to upload an image"}</span>
                      <input type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} required={campaign.proof_type === "image"} />
                    </label>
                  </div>
                )}
                <div className="mb-4">
                  <Label>Notes / response {campaign.proof_type === "text" && "*"}</Label>
                  <Textarea value={proofText} onChange={(e) => setProofText(e.target.value)} rows={3} required={campaign.proof_type === "text"} placeholder="Add context for the AI validators..." />
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? "Awaiting consensus..." : `Submit & earn ${genLabel(campaign.reward)}`}
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Cooldown: {campaign.cooldown_seconds}s . Max {campaign.max_per_user} per worker
                </p>
              </form>
            )}

            {submissions && submissions.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h2 className="mb-4 text-xl font-bold">{isOwner ? "All submissions" : "Your submissions"}</h2>
                <div className="space-y-3">
                  {submissions.map((s) => <SubmissionRow key={s.id} sub={s} />)}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="glass rounded-2xl p-6 text-center">
              <div className="text-xs uppercase text-muted-foreground">Reward per proof</div>
              <div className="mt-1 text-4xl font-bold text-gradient">{genLabel(campaign.reward)}</div>
              <div className="mt-4 space-y-2 text-left text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Paid out</span><span className="font-mono">{genLabel(campaign.spent)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Funded</span><span className="font-mono">{genLabel(campaign.funded)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-mono">{genLabel(campaign.budget)}</span></div>
                <Progress value={pct} className="h-1.5" />
                <div className="text-center text-xs text-muted-foreground">{slots} slots remaining</div>
              </div>
            </div>
            {!address && (
              <div className="glass rounded-2xl p-4 text-center text-sm text-muted-foreground">
                Connect your wallet to submit proof
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function SubmissionRow({ sub }: { sub: ChainSubmission }) {
  const status = sub.status;
  const cls = status === "approved" ? "border-success/40 bg-success/5"
    : status === "rejected" ? "border-destructive/40 bg-destructive/5"
    : status === "review" ? "border-accent/40 bg-accent/5"
    : "border-border/50";

  const StatusIcon = status === "approved" ? CheckCircle2
    : status === "rejected" ? XCircle
    : status === "review" ? Hourglass
    : Clock;

  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium capitalize">
          <StatusIcon className={`h-4 w-4 ${status === "review" ? "animate-pulse text-accent" : status === "approved" ? "text-success" : status === "rejected" ? "text-destructive" : ""}`} />
          {status === "review" ? "manual review" : status}
        </div>
        <span className="text-xs text-muted-foreground">{chainDate(sub.created_at).toLocaleString()}</span>
      </div>
      {sub.feedback && <p className="mb-3 text-sm text-muted-foreground">"{sub.feedback}"</p>}
      {sub.confidence > 0 && (
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <Score label="Relevance" value={sub.relevance} />
          <Score label="Quality" value={sub.quality} />
          <Score label="Spam" value={sub.spam} invert />
          <Score label="Confidence" value={sub.confidence} />
        </div>
      )}
      {(sub.proof_url || sub.image_path || sub.proof_text) && (
        <div className="mt-3 space-y-1 border-t border-border/40 pt-3 text-xs text-muted-foreground">
          {sub.proof_url && <div>🔗 <a href={sub.proof_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{sub.proof_url}</a></div>}
          {sub.image_path && <ProofImageLink path={sub.image_path} />}
          {sub.proof_text && <p className="italic">"{sub.proof_text}"</p>}
        </div>
      )}
      {status === "approved" && fromWei(sub.reward_paid) > 0 && (
        <div className="mt-3 text-xs text-success">Credited {genLabel(sub.reward_paid)} to your onchain balance</div>
      )}
    </div>
  );
}

function Score({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const good = invert ? value < 30 : value >= 70;
  const cls = good ? "text-success" : value < 50 || (invert && value > 60) ? "text-destructive" : "text-warning";
  return (
    <div>
      <div className={`font-mono text-base font-bold ${cls}`}>{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}
