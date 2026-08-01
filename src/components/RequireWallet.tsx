import { useAccount } from "wagmi";
import { useAuth } from "@/hooks/useAuth";
import { Wallet } from "lucide-react";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Header } from "@/components/Header";

/**
 * Gates a page behind wallet connection. Shows an inline connect prompt
 * instead of redirecting to a removed /auth route.
 */
export function RequireWallet({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isConnected } = useAccount();
  const ready = !loading && isConnected && user;

  if (ready) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
          <Wallet className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="font-display text-3xl font-bold">Connect your wallet</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          ProofFlow AI is fully GenLayer native. Connect a wallet to access this page.
          Your wallet address is your identity. No email, no password.
        </p>
        <div className="mt-6 flex justify-center">
          <ConnectWalletButton />
        </div>
      </main>
    </div>
  );
}
