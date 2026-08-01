import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Settings as SettingsIcon, User, Wallet, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Header } from "@/components/Header";
import { RequireWallet } from "@/components/RequireWallet";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings")({
  component: () => <RequireWallet><SettingsPage /></RequireWallet>,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { address, isConnected } = useAccount();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({ display_name: displayName || null, bio: bio || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    refetch();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-10 space-y-8">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Your public profile and wallet</p>
          </div>
        </div>

        <section className="glass space-y-4 rounded-2xl p-6">
          <div className="flex items-center gap-2 font-semibold"><User className="h-4 w-4" />Public profile</div>
          <div>
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <Label>Bio</Label>
            <Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell brands about yourself" />
          </div>
          <Button onClick={save} disabled={saving} variant="hero">{saving ? "Saving..." : "Save profile"}</Button>
          {profile && (
            <Link to="/u/$id" params={{ id: profile.id }} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              View public profile <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </section>

        <section className="glass space-y-4 rounded-2xl p-6">
          <div className="flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4" />GenLayer wallet</div>
          {isConnected && address ? (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="text-xs text-muted-foreground">Primary identity</div>
              <div className="mt-1 font-mono text-sm break-all">{address}</div>
              {profile?.wallet_address?.toLowerCase() === address.toLowerCase() ? (
                <div className="mt-2 text-xs text-success">Linked to your account</div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">Syncing to profile...</div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-4">
              <span className="text-sm text-muted-foreground">No wallet connected</span>
              <ConnectWalletButton />
            </div>
          )}
        </section>

        <section className="glass space-y-3 rounded-2xl p-6">
          <div className="flex items-center gap-2 font-semibold"><User className="h-4 w-4" />Session</div>
          <div className="text-sm text-muted-foreground">
            Wallet first. No email, no password. Disconnecting your wallet signs you out.
          </div>
          <Button variant="outline" size="sm" onClick={async () => { await signOut(); nav({ to: "/" }); }}>
            Sign out
          </Button>
        </section>
      </main>
    </div>
  );
}
