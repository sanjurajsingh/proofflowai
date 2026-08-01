import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, CheckCircle2, XCircle, TrendingUp, Award, ArrowLeft, Wallet } from "lucide-react";
import { Header } from "@/components/Header";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/u/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Worker profile . ProofFlow AI` },
      { name: "description", content: `Public reputation for worker ${params.id}` },
    ],
  }),
  component: PublicProfile,
});

function PublicProfile() {
  const { id } = Route.useParams();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, bio, trust_score, total_submissions, approved_submissions, total_earned, wallet_address, created_at")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const { data: subStats } = useQuery({
    queryKey: ["public-subs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("submissions")
        .select("status")
        .eq("user_id", id);
      const total = data?.length ?? 0;
      const approved = data?.filter((s) => s.status === "approved" || s.status === "paid").length ?? 0;
      const rejected = data?.filter((s) => s.status === "rejected").length ?? 0;
      return { total, approved, rejected };
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="glass h-64 animate-pulse rounded-2xl" />
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-md px-6 py-20 text-center">
          <h1 className="text-2xl font-bold">Worker not found</h1>
          <Link to="/marketplace"><Button variant="outline" className="mt-4">Back to marketplace</Button></Link>
        </main>
      </div>
    );
  }

  const completion = subStats && subStats.total > 0 ? (subStats.approved / subStats.total) * 100 : 0;
  const trust = profile.trust_score ?? 50;
  const tier =
    trust >= 80 ? { label: "Trusted", cls: "bg-success/20 text-success border-success/30" } :
    trust >= 50 ? { label: "Established", cls: "bg-primary/20 text-primary border-primary/30" } :
    { label: "New", cls: "bg-muted text-muted-foreground border-border" };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <Link to="/marketplace"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" />Back</Button></Link>

        <div className="glass rounded-2xl p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold text-primary-foreground">
                {(profile.display_name ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h1 className="font-display text-3xl font-bold">{profile.display_name ?? "Anonymous worker"}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className={tier.cls}>{tier.label}</Badge>
                  {profile.wallet_address && (
                    <span className="inline-flex items-center gap-1 font-mono text-xs">
                      <Wallet className="h-3 w-3" />
                      {profile.wallet_address.slice(0, 6)}…{profile.wallet_address.slice(-4)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {profile.bio && <p className="mt-4 text-sm text-muted-foreground">{profile.bio}</p>}
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />Trust score
            </div>
            <span className="font-display text-2xl font-bold">{trust}<span className="text-base text-muted-foreground">/100</span></span>
          </div>
          <Progress value={trust} className="mt-3 h-2" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Stat icon={CheckCircle2} label="Approved" value={subStats?.approved ?? 0} color="text-success" />
          <Stat icon={XCircle} label="Rejected" value={subStats?.rejected ?? 0} color="text-destructive" />
          <Stat icon={Award} label="Completion rate" value={`${completion.toFixed(0)}%`} />
          <Stat icon={TrendingUp} label="Total earned" value={`${Number(profile.total_earned ?? 0).toFixed(2)} GEN`} />
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color?: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`h-4 w-4 ${color ?? ""}`} />{label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
