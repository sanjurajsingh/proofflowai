import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { money } from "@/lib/format";
import { submitProof } from "@/lib/submit.functions";

export const Route = createFileRoute("/campaigns/$id")({
  component: CampaignDetail,
});

function CampaignDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [proofText, setProofText] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitProofFn = useServerFn(submitProof);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const isOwner = user?.id === campaign?.brand_id;

  const { data: submissions } = useQuery({
    queryKey: ["subs", id, user?.id, isOwner],
    enabled: !!campaign && !!user,
    refetchInterval: (q) => {
      const list = (q.state.data ?? []) as Array<{ status: string }>;
      return list.some((s) => s.status === "queued" || s.status === "ai_reviewing") ? 2000 : false;
    },
    queryFn: async () => {
      const q = supabase.from("submissions").select("*").eq("campaign_id", id).order("created_at", { ascending: false });
      if (!isOwner) q.eq("user_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !campaign) return;
    setSubmitting(true);
    try {
      let proofImagePath: string | null = null;
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("proofs").upload(path, file);
        if (upErr) throw upErr;
        proofImagePath = path;
      }
      await submitProofFn({
        data: {
          campaignId: campaign.id,
          proofText: proofText || null,
          proofUrl: proofUrl || null,
          proofImagePath,
        },
      });
      toast.success("Proof submitted — AI is reviewing now.");
      setProofText(""); setProofUrl(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["subs", id] });
    } catch (err: any) {
      toast.error(err?.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-background"><Header /><div className="p-10 text-center text-muted-foreground">Loading...</div></div>;
  if (!campaign) return <div className="min-h-screen bg-background"><Header /><div className="p-10 text-center">Campaign not found</div></div>;

  const pct = (Number(campaign.spent_budget) / Number(campaign.total_budget)) * 100;
  const slots = Math.floor((Number(campaign.total_budget) - Number(campaign.spent_budget)) / Number(campaign.reward_amount));

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
                <Badge variant={campaign.status === "active" ? "default" : "secondary"} className="capitalize">{campaign.status}</Badge>
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

            {user && !isOwner && campaign.status === "active" && slots > 0 && (
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
                  <Textarea value={proofText} onChange={(e) => setProofText(e.target.value)} rows={3} required={campaign.proof_type === "text"} placeholder="Add context for the AI reviewer..." />
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? "Queuing..." : `Submit & earn ${money(campaign.reward_amount)}`}
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
              <div className="mt-1 text-4xl font-bold text-gradient">{money(campaign.reward_amount)}</div>
              <div className="mt-4 space-y-2 text-left text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Spent</span><span className="font-mono">{money(campaign.spent_budget)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-mono">{money(campaign.total_budget)}</span></div>
                <Progress value={pct} className="h-1.5" />
                <div className="text-center text-xs text-muted-foreground">{slots} slots remaining</div>
              </div>
            </div>
            {!user && (
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

function SubmissionRow({ sub }: { sub: any }) {
  const status = sub.status as string;
  const cls = status === "approved" || status === "paid" ? "border-success/40 bg-success/5"
    : status === "rejected" ? "border-destructive/40 bg-destructive/5"
    : status === "ai_reviewing" || status === "queued" ? "border-accent/40 bg-accent/5"
    : "border-border/50";

  const StatusIcon = status === "approved" || status === "paid" ? CheckCircle2
    : status === "rejected" ? XCircle
    : status === "ai_reviewing" ? Activity
    : status === "queued" ? Hourglass
    : Clock;

  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium capitalize">
          <StatusIcon className={`h-4 w-4 ${status === "ai_reviewing" || status === "queued" ? "animate-pulse text-accent" : status === "approved" || status === "paid" ? "text-success" : status === "rejected" ? "text-destructive" : ""}`} />
          {status.replace("_", " ")}
        </div>
        <span className="text-xs text-muted-foreground">{new Date(sub.created_at).toLocaleString()}</span>
      </div>
      {sub.ai_feedback && <p className="mb-3 text-sm text-muted-foreground">"{sub.ai_feedback}"</p>}
      {sub.ai_confidence_score !== null && sub.ai_confidence_score !== undefined && (
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <Score label="Relevance" value={sub.ai_relevance_score} />
          <Score label="Quality" value={sub.ai_quality_score} />
          <Score label="Spam" value={sub.ai_spam_score} invert />
          <Score label="Confidence" value={sub.ai_confidence_score} />
        </div>
      )}
      {(sub.proof_url || sub.proof_image_url || sub.proof_text) && (
        <div className="mt-3 space-y-1 border-t border-border/40 pt-3 text-xs text-muted-foreground">
          {sub.proof_url && <div>🔗 <a href={sub.proof_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{sub.proof_url}</a></div>}
          {sub.proof_image_url && <ProofImageLink path={sub.proof_image_url} />}
          {sub.proof_text && <p className="italic">"{sub.proof_text}"</p>}
        </div>
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
