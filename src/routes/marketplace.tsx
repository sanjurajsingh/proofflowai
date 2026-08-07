import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, Users, Image, Link2, FileText, Camera } from "lucide-react";
import { Header } from "@/components/Header";
import { fromWei, genLabel, getCampaigns, qk } from "@/lib/genlayer/proofflow";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/marketplace")({
  component: Marketplace,
});

const proofIcons: Record<string, any> = {
  screenshot: Camera, link: Link2, image: Image, text: FileText,
};

function Marketplace() {
  const { data: campaigns, isLoading } = useQuery({
    queryKey: qk.campaigns,
    queryFn: getCampaigns,
    select: (rows) => rows.filter((c) => c.active).sort((a, b) => b.created_at - a.created_at),
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10">
          <h1 className="text-4xl font-bold">Task marketplace</h1>
          <p className="mt-2 text-muted-foreground">Complete tasks, submit proof, earn instantly.</p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass h-56 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : !campaigns?.length ? (
          <div className="glass rounded-2xl p-16 text-center">
            <p className="text-muted-foreground">No active campaigns yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => {
              const Icon = proofIcons[c.proof_type] ?? FileText;
              const remaining = fromWei(c.funded) - fromWei(c.spent);
              const reward = fromWei(c.reward);
              const slots = reward > 0 ? Math.floor(remaining / reward) : 0;
              return (
                <Link key={c.id} to="/campaigns/$id" params={{ id: String(c.id) }} className="group">
                  <div className="flex h-full flex-col glass rounded-2xl p-6 transition-all hover:border-primary/50 hover:shadow-glow">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="rounded-full bg-gradient-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-glow">
                        {genLabel(c.reward)}
                      </div>
                    </div>
                    <h3 className="font-display text-lg font-semibold leading-tight group-hover:text-primary">{c.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{c.description}</p>
                    <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{slots} slots</span>
                      {c.category && <Badge variant="secondary" className="text-xs">{c.category}</Badge>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
