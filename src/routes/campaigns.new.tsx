import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, AlertTriangle, FileText, Coins, ListChecks,
  ShieldCheck, Users, Brain, Eye, Rocket, Plus, X, Check, Image as ImageIcon,
  Link2, Camera, Type as TypeIcon, Save, Hexagon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Header } from "@/components/Header";
import { RequireWallet } from "@/components/RequireWallet";
import { useAccount, useBalance } from "wagmi";
import { createCampaign, fundCampaign, getBrandCampaigns, type Address } from "@/lib/genlayer/proofflow";

export const Route = createFileRoute("/campaigns/new")({
  component: () => <RequireWallet><NewCampaign /></RequireWallet>,
});

type Step = "basics" | "reward" | "proof" | "validation" | "submission" | "ai" | "preview";
type ProofTypeKey = "screenshot" | "link" | "image" | "text";

const STEPS: { key: Step; label: string; icon: any }[] = [
  { key: "basics", label: "Basics", icon: FileText },
  { key: "reward", label: "Reward", icon: Coins },
  { key: "proof", label: "Proof", icon: Camera },
  { key: "validation", label: "Validation", icon: ListChecks },
  { key: "submission", label: "Submission rules", icon: Users },
  { key: "ai", label: "AI review", icon: Brain },
  { key: "preview", label: "Preview and publish", icon: Eye },
];

const PROOF_TYPES: { key: ProofTypeKey; label: string; icon: any; desc: string }[] = [
  { key: "screenshot", label: "Screenshot", icon: Camera, desc: "Image of completed action" },
  { key: "link", label: "Link", icon: Link2, desc: "URL pointing to the work" },
  { key: "image", label: "Image upload", icon: ImageIcon, desc: "Custom image asset" },
  { key: "text", label: "Text response", icon: TypeIcon, desc: "Written response or paste" },
];

type FormState = {
  title: string;
  description: string;
  instructions: string;
  category: string;
  cover_image_url: string;
  tags: string[];
  reward_amount: string;
  total_budget: string;
  max_submissions: string;
  start_at: string;
  end_at: string;
  required_proof_types: ProofTypeKey[];
  required_keywords: string[];
  min_text_length: string;
  allowed_domains: string[];
  forbidden_domains: string[];
  min_trust_score: string;
  cooldown_seconds: string;
  max_per_user: string;
  auto_approve_threshold: number;
  manual_review_threshold: number;
  reject_threshold: number;
};

const initial: FormState = {
  title: "",
  description: "",
  instructions: "",
  category: "",
  cover_image_url: "",
  tags: [],
  reward_amount: "1.00",
  total_budget: "50",
  max_submissions: "",
  start_at: "",
  end_at: "",
  required_proof_types: ["screenshot"],
  required_keywords: [],
  min_text_length: "0",
  allowed_domains: [],
  forbidden_domains: [],
  min_trust_score: "0",
  cooldown_seconds: "60",
  max_per_user: "1",
  auto_approve_threshold: 85,
  manual_review_threshold: 60,
  reject_threshold: 30,
};

function NewCampaign() {
  const { address } = useAccount();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("basics");
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  if (!address) return null;

  // Wallet GEN balance funds the campaign directly via fund_campaign()
  const { data: walletBalance } = useBalance({ address });

  const budget = Number(form.total_budget) || 0;
  const reward = Number(form.reward_amount) || 0;
  const avail = walletBalance ? Number(walletBalance.formatted) : 0;
  const insufficient = !!walletBalance && budget > avail;
  const maxSlots = reward > 0 ? Math.floor(budget / reward) : 0;

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, stepIdx + 1)].key);
  const prev = () => setStep(STEPS[Math.max(0, stepIdx - 1)].key);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const canAdvance = useMemo(() => {
    if (step === "basics") return form.title.trim().length >= 3 && form.description.trim().length >= 10;
    if (step === "reward") return reward > 0 && budget > 0 && budget >= reward;
    if (step === "proof") return form.required_proof_types.length > 0;
    return true;
  }, [step, form, reward, budget]);

  async function persist(asStatus: "draft" | "active") {
    if (asStatus === "active" && insufficient) {
      toast.error("Wallet GEN balance is lower than the budget you want to fund");
      return;
    }
    setSubmitting(true);
    try {
      const account = address as Address;
      const { campaignId } = await createCampaign(account, {
        title: form.title.trim(),
        description: form.description.trim(),
        instructions: form.instructions.trim(),
        proof_type: form.required_proof_types[0],
        category: form.category.trim(),
        cover_image_path: form.cover_image_url.trim(),
        reward,
        budget,
        max_per_user: Number(form.max_per_user) || 1,
        cooldown_seconds: Number(form.cooldown_seconds) || 60,
        min_trust: Number(form.min_trust_score) || 0,
        min_text_length: Number(form.min_text_length) || 0,
        required_keywords: form.required_keywords,
      });

      // The write receipt may not expose the return value — resolve the id from chain state.
      let id = typeof campaignId === "number" ? campaignId : null;
      if (id === null) {
        const mine = await getBrandCampaigns(account);
        id = mine.length ? Math.max(...mine.map((c) => c.id)) : null;
      }
      if (id === null) throw new Error("Campaign created but its id could not be resolved");

      if (asStatus === "active") {
        await fundCampaign(account, id, budget);
        toast.success("Campaign created and funded onchain");
      } else {
        toast.success("Campaign created. Fund it from your dashboard to go live");
      }
      nav({ to: "/campaigns/$id", params: { id: String(id) } });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save campaign");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/dashboard" })} className="mb-4">
          <ArrowLeft className="h-4 w-4" />Back to dashboard
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
            <Hexagon className="h-3.5 w-3.5" /> New bounty campaign
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold">Design a verified proof campaign</h1>
          <p className="mt-2 text-muted-foreground">Configure the task, validation rules, AI thresholds, and publish it onchain.</p>
        </div>

        {/* Step rail */}
        <div className="mb-8 glass rounded-2xl p-3">
          <ol className="flex flex-wrap gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <li key={s.key} className="flex-1">
                  <button
                    type="button"
                    onClick={() => setStep(s.key)}
                    className={`group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${
                      active
                        ? "bg-gradient-primary text-primary-foreground shadow-glow"
                        : done
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${active ? "bg-primary-foreground/20" : done ? "bg-primary/20" : "bg-muted"}`}>
                      {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                    </span>
                    <span className="hidden md:inline font-medium">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div className="glass rounded-2xl p-6 md:p-8">
            {step === "basics" && <BasicsStep form={form} update={update} />}
            {step === "reward" && <RewardStep form={form} update={update} maxSlots={maxSlots} avail={avail} insufficient={insufficient} />}
            {step === "proof" && <ProofStep form={form} update={update} />}
            {step === "validation" && <ValidationStep form={form} update={update} />}
            {step === "submission" && <SubmissionStep form={form} update={update} />}
            {step === "ai" && <AIStep form={form} update={update} />}
            {step === "preview" && <PreviewStep form={form} maxSlots={maxSlots} insufficient={insufficient} avail={avail} />}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-6">
              <Button variant="ghost" onClick={prev} disabled={stepIdx === 0}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                {step !== "preview" ? (
                  <Button variant="hero" onClick={next} disabled={!canAdvance}>
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => persist("draft")} disabled={submitting}>
                      <Save className="h-4 w-4" /> Create without funding
                    </Button>
                    <Button variant="hero" onClick={() => persist("active")} disabled={submitting || insufficient}>
                      <Rocket className="h-4 w-4" /> {submitting ? "Publishing..." : "Fund and publish"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Side rail: summary + treasury */}
          <aside className="space-y-4">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Coins className="h-3.5 w-3.5" /> Wallet
              </div>
              <div className="mt-2 font-display text-2xl font-bold text-gradient">{avail.toFixed(2)} GEN</div>
              <div className="mt-1 text-xs text-muted-foreground">available to fund campaigns</div>
              {insufficient && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Need {(budget - avail).toFixed(2)} GEN more in your wallet to fund this budget.</span>
                </div>
              )}
            </div>

            <div className="glass rounded-2xl p-5 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Summary</div>
              <dl className="mt-3 space-y-2">
                <SumRow k="Reward" v={`${reward.toFixed(2)} GEN`} />
                <SumRow k="Budget" v={`${budget.toFixed(2)} GEN`} />
                <SumRow k="Max slots" v={`${maxSlots}`} />
                <SumRow k="Proof types" v={form.required_proof_types.length.toString()} />
                <SumRow k="Min trust" v={`${form.min_trust_score}/100`} />
              </dl>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function SumRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-xs">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono text-foreground">{v}</dd>
    </div>
  );
}

/* ---------- STEPS ---------- */

function BasicsStep({ form, update }: { form: FormState; update: any }) {
  return (
    <div className="space-y-5">
      <StepHeading icon={FileText} title="Campaign basics" subtitle="Tell workers what they're doing and why it matters." />
      <div>
        <Label>Campaign title</Label>
        <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Post a verified review on G2" maxLength={120} />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Short pitch shown in the marketplace card" maxLength={500} />
      </div>
      <div>
        <Label>Detailed instructions</Label>
        <Textarea rows={5} value={form.instructions} onChange={(e) => update("instructions", e.target.value)} placeholder="Step by step requirements, what counts as valid proof, edge cases" maxLength={3000} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Category</Label>
          <Input value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="Marketing, Research, Testing" />
        </div>
        <div>
          <Label>Cover image URL (optional)</Label>
          <Input value={form.cover_image_url} onChange={(e) => update("cover_image_url", e.target.value)} placeholder="https://..." />
        </div>
      </div>
      <ChipInput
        label="Tags"
        placeholder="Type a tag and press enter"
        values={form.tags}
        onChange={(v) => update("tags", v)}
        max={8}
      />
    </div>
  );
}

function RewardStep({ form, update, maxSlots, avail, insufficient }:
  { form: FormState; update: any; maxSlots: number; avail: number; insufficient: boolean }) {
  return (
    <div className="space-y-5">
      <StepHeading icon={Coins} title="Reward and budget" subtitle="GEN is escrowed in the Intelligent Contract when you fund the campaign." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Reward per submission (GEN)</Label>
          <Input type="number" min="0.01" step="0.01" value={form.reward_amount} onChange={(e) => update("reward_amount", e.target.value)} />
        </div>
        <div>
          <Label>Total budget (GEN)</Label>
          <Input type="number" min="1" step="1" value={form.total_budget} onChange={(e) => update("total_budget", e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Max submissions (optional cap)</Label>
        <Input type="number" min="1" placeholder={`${maxSlots} computed from budget`} value={form.max_submissions} onChange={(e) => update("max_submissions", e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Start date (optional)</Label>
          <Input type="datetime-local" value={form.start_at} onChange={(e) => update("start_at", e.target.value)} />
        </div>
        <div>
          <Label>End date (optional)</Label>
          <Input type="datetime-local" value={form.end_at} onChange={(e) => update("end_at", e.target.value)} />
        </div>
      </div>
      <div className={`rounded-xl border p-4 text-sm ${insufficient ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
        <div className="flex justify-between text-muted-foreground">
          <span>Approx max submissions</span>
          <span className="font-mono text-primary font-bold">{maxSlots}</span>
        </div>
        <div className="mt-2 flex justify-between text-muted-foreground">
          <span>Wallet available</span>
          <span className="font-mono">{avail.toFixed(2)} GEN</span>
        </div>
        {insufficient && (
          <div className="mt-2 flex items-start gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>Insufficient wallet balance. Use the testnet faucet before funding.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ProofStep({ form, update }: { form: FormState; update: any }) {
  const toggle = (key: ProofTypeKey) => {
    const has = form.required_proof_types.includes(key);
    const next = has
      ? form.required_proof_types.filter((k) => k !== key)
      : [...form.required_proof_types, key];
    if (next.length === 0) return;
    update("required_proof_types", next);
  };
  return (
    <div className="space-y-5">
      <StepHeading icon={Camera} title="Proof requirements" subtitle="Pick one or more proof types. Workers must satisfy each one." />
      <div className="grid gap-3 sm:grid-cols-2">
        {PROOF_TYPES.map((p) => {
          const Icon = p.icon;
          const active = form.required_proof_types.includes(p.key);
          return (
            <button
              type="button"
              key={p.key}
              onClick={() => toggle(p.key)}
              className={`group flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                active
                  ? "border-primary bg-primary/10 shadow-glow"
                  : "border-border/60 hover:border-primary/40"
              }`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{p.label}</h4>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ValidationStep({ form, update }: { form: FormState; update: any }) {
  return (
    <div className="space-y-5">
      <StepHeading icon={ListChecks} title="Validation rules" subtitle="What the AI looks for when scoring a submission." />
      <ChipInput
        label="Required keywords (any must appear in proof text)"
        placeholder="e.g. genlayer, testnet"
        values={form.required_keywords}
        onChange={(v) => update("required_keywords", v)}
        max={20}
      />
      <div>
        <Label>Minimum text length (characters)</Label>
        <Input type="number" min="0" step="10" value={form.min_text_length} onChange={(e) => update("min_text_length", e.target.value)} />
      </div>
      <ChipInput
        label="Allowed domains (leave empty for any)"
        placeholder="g2.com"
        values={form.allowed_domains}
        onChange={(v) => update("allowed_domains", v)}
        max={20}
      />
      <ChipInput
        label="Forbidden domains"
        placeholder="bit.ly"
        values={form.forbidden_domains}
        onChange={(v) => update("forbidden_domains", v)}
        max={20}
      />
      <div>
        <Label>Minimum worker trust score: <span className="font-mono text-primary">{form.min_trust_score}/100</span></Label>
        <Slider
          value={[Number(form.min_trust_score)]}
          min={0} max={100} step={5}
          onValueChange={([v]) => update("min_trust_score", String(v))}
          className="mt-3"
        />
      </div>
    </div>
  );
}

function SubmissionStep({ form, update }: { form: FormState; update: any }) {
  return (
    <div className="space-y-5">
      <StepHeading icon={Users} title="Submission rules" subtitle="Control how often and how many times workers can submit." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Cooldown between submissions (seconds)</Label>
          <Input type="number" min="0" step="10" value={form.cooldown_seconds} onChange={(e) => update("cooldown_seconds", e.target.value)} />
        </div>
        <div>
          <Label>Max submissions per worker</Label>
          <Input type="number" min="1" step="1" value={form.max_per_user} onChange={(e) => update("max_per_user", e.target.value)} />
        </div>
      </div>
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
        Geographic restrictions are coming soon. Future releases will allow per region targeting and exclusion.
      </div>
    </div>
  );
}

function AIStep({ form, update }: { form: FormState; update: any }) {
  return (
    <div className="space-y-6">
      <StepHeading icon={Brain} title="AI review thresholds" subtitle="Tune how aggressively the AI auto approves, escalates, or rejects." />
      <ThresholdSlider
        label="Auto approve at or above"
        accent="text-success"
        value={form.auto_approve_threshold}
        onChange={(v) => update("auto_approve_threshold", v)}
      />
      <ThresholdSlider
        label="Send to manual review at or above"
        accent="text-accent"
        value={form.manual_review_threshold}
        onChange={(v) => update("manual_review_threshold", v)}
        max={form.auto_approve_threshold - 1}
      />
      <ThresholdSlider
        label="Auto reject below"
        accent="text-destructive"
        value={form.reject_threshold}
        onChange={(v) => update("reject_threshold", v)}
        max={form.manual_review_threshold - 1}
      />
      <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-xs text-muted-foreground">
        Submissions scored between <span className="font-mono text-foreground">{form.reject_threshold}</span> and{" "}
        <span className="font-mono text-foreground">{form.manual_review_threshold - 1}</span> are queued for your team to review manually.
      </div>
    </div>
  );
}

function PreviewStep({ form, maxSlots, insufficient, avail }:
  { form: FormState; maxSlots: number; insufficient: boolean; avail: number }) {
  return (
    <div className="space-y-6">
      <StepHeading icon={Eye} title="Preview and publish" subtitle="This is exactly what workers see in the marketplace." />

      {/* Worker preview card */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-card/60 to-card/20 p-6">
        <div className="mb-3 flex flex-wrap gap-2">
          {form.required_proof_types.map((p) => (
            <Badge key={p} className="capitalize">{p}</Badge>
          ))}
          {form.category && <Badge variant="secondary">{form.category}</Badge>}
          {form.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
        </div>
        <h2 className="font-display text-2xl font-bold">{form.title || "Untitled campaign"}</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{form.description || "No description yet."}</p>
        {form.instructions && (
          <div className="mt-4 rounded-xl border border-border/60 bg-background/40 p-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">Instructions</div>
            <p className="whitespace-pre-line text-sm">{form.instructions}</p>
          </div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <PreviewStat label="Reward" value={`${Number(form.reward_amount).toFixed(2)} GEN`} />
          <PreviewStat label="Slots" value={maxSlots.toString()} />
          <PreviewStat label="Min trust" value={`${form.min_trust_score}/100`} />
        </div>
      </div>

      {/* Publishing checklist */}
      <div className="space-y-2 rounded-2xl border border-border/60 bg-card/40 p-5 text-sm">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Publishing checklist</div>
        <Check2 ok={form.title.length >= 3} label="Title set" />
        <Check2 ok={form.description.length >= 10} label="Description written" />
        <Check2 ok={form.required_proof_types.length > 0} label="At least one proof type" />
        <Check2 ok={!insufficient} label={`Treasury covers budget (${avail.toFixed(2)} GEN available)`} />
      </div>
    </div>
  );
}

/* ---------- HELPERS ---------- */

function StepHeading({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
      </div>
      <p className="ml-11 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function ChipInput({ label, placeholder, values, onChange, max = 10 }:
  { label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void; max?: number }) {
  const [v, setV] = useState("");
  const add = () => {
    const t = v.trim().toLowerCase();
    if (!t || values.includes(t) || values.length >= max) return;
    onChange([...values, t]);
    setV("");
  };
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => onChange(values.filter((x) => x !== t))}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs hover:border-destructive/40 hover:text-destructive"
            >
              {t} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThresholdSlider({ label, value, onChange, max = 100, accent }:
  { label: string; value: number; onChange: (v: number) => void; max?: number; accent?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className={`font-mono text-lg font-bold ${accent ?? ""}`}>{value}</span>
      </div>
      <Slider
        value={[value]}
        min={0} max={Math.max(0, max)} step={5}
        onValueChange={([v]) => onChange(v)}
        className="mt-3"
      />
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-display text-sm font-bold">{value}</div>
    </div>
  );
}

function Check2({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`flex h-4 w-4 items-center justify-center rounded-full ${ok ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
        {ok ? <Check className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
      </span>
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
