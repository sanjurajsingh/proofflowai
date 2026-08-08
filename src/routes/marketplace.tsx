import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Image, Link2, FileText, Camera, AlertTriangle, ShieldCheck, Coins } from "lucide-react";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { fromWei, genLabel, getCampaigns, qk } from "@/lib/genlayer/proofflow";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Campaign marketplace — ProofFlow" },
      {
        name: "description",
        content:
          "Browse open ProofFlow campaigns read straight from the GenLayer Intelligent Contract. Complete the task, submit proof, earn GEN.",
      },
      { property: "og:title", content: "Campaign marketplace — ProofFlow" },
      {
        property: "og:description",
        content: "Open, funded reward campaigns verified onchain by GenLayer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Marketplace,
});

const proofIcons: Record<string, any> = {
  screenshot: Camera,
  link: Link2,
  image: Image,
  text: FileText,
};

const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

function Marketplace() {
  const {
    data: campaigns,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: qk.campaigns,
    queryFn: getCampaigns,
    select: (rows) => [...rows].sort((a, b) => b.created_at - a.created_at),
  });

  const open = campaigns?.filter((c) => c.active) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Campaign marketplace</h1>
            <p className="mt-2 text-muted-foreground">
              Every campaign below is read live from the GenLayer Intelligent Contract. Complete the
              task, submit proof, get verified onchain.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            {isRefetching ? "Refreshing…" : "Refresh from chain"}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass h-64 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="glass rounded-2xl border-destructive/40 p-12 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <h2 className="mt-3 text-lg font-semibold">Could not read campaigns from the contract</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {(error as Error)?.message ?? "The GenLayer RPC did not respond."}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : !open.length ? (
          <div className="glass rounded-2xl p-16 text-center">
            <Coins className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">No active campaigns onchain yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {campaigns?.length
                ? `${campaigns.length} campaign(s) exist but none are active and funded right now.`
                : "Be the first — create a campaign and fund it in GEN."}
            </p>
            <Link to="/campaigns/new">
              <Button variant="hero" className="mt-5">
                Create campaign
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {open.map((c) => {
              const Icon = proofIcons[c.proof_type] ?? FileText;
              const funded = fromWei(c.funded);
              const spent = fromWei(c.spent);
              const reward = fromWei(c.reward);
              const remaining = Math.max(0, funded - spent);
              const slots = reward > 0 ? Math.floor(remaining / reward) : 0;
              const pct = funded > 0 ? (spent / funded) * 100 : 0;

              return (
                <div
                  key={c.id}
                  className="flex h-full flex-col glass rounded-2xl p-6 transition-all hover:border-primary/50 hover:shadow-glow"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="rounded-full bg-gradient-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-glow">
                      {genLabel(c.reward)} / proof
                    </div>
                  </div>

                  <Link to="/campaigns/$id" params={{ id: String(c.id) }} className="group">
                    <h3 className="font-display text-lg font-semibold leading-tight group-hover:text-primary">
                      {c.title}
                    </h3>
                  </Link>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{c.description}</p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="capitalize">
                      {c.proof_type} proof
                    </Badge>
                    {c.category && <Badge variant="outline">{c.category}</Badge>}
                    {c.min_trust > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        trust {c.min_trust}+
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {remaining.toFixed(2)} of {funded.toFixed(2)} GEN left
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {slots} slots
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground">
                    Created by <span className="font-mono">{short(c.owner)}</span> · max{" "}
                    {c.max_per_user} per worker
                  </div>

                  <div className="mt-5 flex gap-2 pt-1">
                    <Link
                      to="/campaigns/$id"
                      params={{ id: String(c.id) }}
                      className="flex-1"
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        View campaign
                      </Button>
                    </Link>
                    <Link
                      to="/campaigns/$id"
                      params={{ id: String(c.id) }}
                      hash="submit"
                      className="flex-1"
                    >
                      <Button variant="hero" size="sm" className="w-full" disabled={slots === 0}>
                        {slots === 0 ? "Fully claimed" : "Submit proof"}
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
