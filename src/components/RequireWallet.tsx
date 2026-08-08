import { Wallet } from "lucide-react";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Header } from "@/components/Header";
import { useWallet } from "@/hooks/useWallet";

/**
 * Gates a page behind wallet connection only — the connected wallet is the
 * identity used for every GenLayer contract call. No backend session required.
 */
export function RequireWallet({ children }: { children: React.ReactNode }) {
  const { isConnected, ready } = useWallet();

  if (isConnected) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
          <Wallet className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="font-display text-3xl font-bold">
          {ready ? "Connect your wallet" : "Restoring your wallet…"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          ProofFlow is fully GenLayer native. Your wallet address is your identity — no email, no
          password.
        </p>
        <div className="mt-6 flex justify-center">
          <ConnectWalletButton />
        </div>
      </main>
    </div>
  );
}
