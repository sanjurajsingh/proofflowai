import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { RequireWallet } from "@/components/RequireWallet";
import { ProofImageLink } from "@/components/ProofImage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { money, shortDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin")({
  component: () => <RequireWallet><Admin /></RequireWallet>,
});

function Admin() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");

  const { data: pending } = useQuery({
    queryKey: ["admin-queue"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*, campaigns(title, reward_amount, brand_id)")
        .in("status", ["pending", "queued", "ai_reviewing"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: payouts } = useQuery({
    queryKey: ["admin-payouts"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_requests").select("*").eq("status", "pending").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const onModerate = async (sub: any, approve: boolean) => {
    try {
      const reward = Number(sub.campaigns?.reward_amount ?? 0);
      const { error } = await supabase.from("submissions").update({
        status: approve ? "approved" : "rejected",
        claim_status: approve ? "claimable" : "unclaimed",
        reward_paid: approve ? reward : null,
        reviewed_at: new Date().toISOString(),
        rejection_reason: approve ? null : "Rejected by moderator",
      }).eq("id", sub.id);
      if (error) throw error;
      toast.success(approve ? "Approved. Reward claimable" : "Rejected");
      qc.invalidateQueries({ queryKey: ["admin-queue"] });
    } catch (e: any) { toast.error(e?.message ?? "Action failed"); }
  };

  const onPayout = async (id: string, action: "paid" | "rejected") => {
    try {
      const { error } = await supabase.from("payout_requests").update({
        status: action,
        processed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      toast.success(action === "paid" ? "Marked settled" : "Rejected");
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
    } catch (e: any) { toast.error(e?.message ?? "Action failed"); }
  };

  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md p-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">Admin only</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don't have access to this page.</p>
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
            <p className="text-sm text-muted-foreground">Submissions and payouts pending review</p>
          </div>
        </div>

        <section>
          <h2 className="mb-4 text-xl font-bold">Submission queue</h2>
          {!pending?.length ? (
            <div className="glass rounded-2xl p-12 text-center text-muted-foreground">All clear.</div>
          ) : (
            <div className="space-y-3">
              {pending.map((s: any) => (
                <div key={s.id} className="glass rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="font-semibold">{s.campaigns?.title}</h3>
                        <Badge variant="secondary">{money(s.campaigns?.reward_amount)}</Badge>
                        <Badge variant="outline" className="capitalize">{s.status.replace("_", " ")}</Badge>
                      </div>
                      {s.ai_feedback && <p className="text-sm text-muted-foreground">AI: "{s.ai_feedback}"</p>}
                      {s.proof_text && <p className="mt-2 text-sm italic">"{s.proof_text}"</p>}
                      {s.proof_url && <a href={s.proof_url} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-primary hover:underline">{s.proof_url}</a>}
                      {s.proof_image_url && <div className="mt-1"><ProofImageLink path={s.proof_image_url} /></div>}
                      <div className="mt-2 text-xs text-muted-foreground">{shortDate(s.created_at)}</div>
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

        <section>
          <h2 className="mb-4 text-xl font-bold">Payout requests</h2>
          {!payouts?.length ? (
            <div className="glass rounded-2xl p-8 text-center text-muted-foreground">No pending payouts.</div>
          ) : (
            <div className="space-y-3">
              {payouts.map((p: any) => (
                <div key={p.id} className="glass flex items-center justify-between rounded-2xl p-4">
                  <div>
                    <div className="font-semibold">{money(p.amount)} to <span className="font-mono text-sm">{p.destination}</span></div>
                    <div className="text-xs text-muted-foreground">{shortDate(p.created_at)} . {p.method}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => onPayout(p.id, "rejected")}><X className="h-4 w-4" />Reject</Button>
                    <Button size="sm" variant="hero" onClick={() => onPayout(p.id, "paid")}><Check className="h-4 w-4" />Mark paid</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
