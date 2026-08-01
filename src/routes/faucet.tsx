import { createFileRoute } from "@tanstack/react-router";
import { useAccount, useBalance } from "wagmi";
import { Droplets, ExternalLink, Copy, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { toast } from "sonner";

export const Route = createFileRoute("/faucet")({
  head: () => ({
    meta: [
      { title: "Get testnet GEN . ProofFlow AI" },
      { name: "description", content: "Onboard to GenLayer testnet. Connect a wallet, claim free GEN, and start earning verified rewards." },
    ],
  }),
  component: FaucetPage,
});

function FaucetPage() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });

  const copy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    toast.success("Address copied");
  };

  const balanceNum = balance ? Number(balance.formatted) : 0;
  const lowBalance = isConnected && balanceNum < 0.01;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Droplets className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl font-bold">Get testnet GEN</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            ProofFlow is fully GenLayer-native. Claim free GEN tokens from the testnet faucet
            to fund campaigns and receive verified rewards.
          </p>
        </div>

        {isConnected && (
          <div className={`mt-6 glass rounded-2xl p-5 ${lowBalance ? "border-amber-500/40" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Current wallet balance</div>
                <div className="mt-1 font-mono text-2xl font-bold">
                  {balance ? `${Number(balance.formatted).toFixed(4)} ${balance.symbol}` : "—"}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>Network: <span className="text-foreground">GenLayer testnet</span></div>
                <div>Chain ID: <code className="font-mono">4221</code></div>
              </div>
            </div>
            {lowBalance && (
              <div className="mt-3 text-xs text-amber-400">
                Low balance. Claim from the faucet below before submitting on-chain claims.
              </div>
            )}
          </div>
        )}

        <ol className="mt-10 space-y-4">
          <Step
            n={1}
            title="Connect your wallet"
            done={isConnected}
            description="We support MetaMask, Rainbow, Coinbase, WalletConnect and more."
            action={
              !isConnected ? (
                <ConnectWalletButton />
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{address}</code>
                  <Button variant="ghost" size="icon" onClick={copy}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )
            }
          />

          <Step
            n={2}
            title="Open the GenLayer faucet"
            description="Paste your wallet address and request testnet GEN. Free, instant, no KYC."
            action={
              <a
                href="https://testnet-faucet.genlayer.foundation/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="hero" disabled={!isConnected}>
                  Open faucet <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            }
          />

          <Step
            n={3}
            title="Start earning"
            description="Browse the marketplace, submit proof, and claim onchain rewards."
            action={
              <a href="/marketplace">
                <Button variant="outline">
                  Go to marketplace <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            }
          />
        </ol>

        <div className="mt-12 rounded-2xl border border-border/60 bg-card/50 p-6 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">About GenLayer testnet</p>
          <p className="mt-2">
            Chain ID <code className="font-mono">4221</code> · Currency <code className="font-mono">GEN</code> ·
            RPC <code className="font-mono">zksync-os-testnet-genlayer.zksync.dev</code>
          </p>
          <p className="mt-2">
            All payments on ProofFlow settle through GenLayer's AI validator consensus.
            No Stripe, no fiat, no intermediaries.
          </p>
        </div>
      </main>
    </div>
  );
}

function Step({
  n, title, description, action, done,
}: {
  n: number;
  title: string;
  description: string;
  action: React.ReactNode;
  done?: boolean;
}) {
  return (
    <li className="glass flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
          {done ? <CheckCircle2 className="h-5 w-5" /> : n}
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="sm:shrink-0">{action}</div>
    </li>
  );
}
