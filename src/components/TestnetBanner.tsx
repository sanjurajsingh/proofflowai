import { AlertTriangle } from "lucide-react";

/**
 * Persistent banner reminding users this runs against a GenLayer test network:
 * rewards are ledgered inside the Intelligent Contract with testnet GEN.
 */
export function TestnetBanner() {
  return (
    <div className="w-full border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-200">
      <span className="inline-flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3" />
        GenLayer testnet · rewards are ledgered onchain in the ProofFlow Intelligent Contract
      </span>
    </div>
  );
}
