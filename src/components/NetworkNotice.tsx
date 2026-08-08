import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";

/**
 * Inline warning shown on any page that writes to the Intelligent Contract
 * while the wallet sits on a different network.
 */
export function NetworkNotice({ className = "" }: { className?: string }) {
  const { wrongNetwork, switchToGenLayer, switching, expectedChain } = useWallet();
  if (!wrongNetwork) return null;

  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm ${className}`}
    >
      <div className="flex items-start gap-2 text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Wrong network. ProofFlow transactions only work on{" "}
          <strong>{expectedChain.name}</strong> (chain {expectedChain.id}).
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={switchToGenLayer} disabled={switching}>
        {switching ? "Switching…" : `Switch to ${expectedChain.name}`}
      </Button>
    </div>
  );
}
