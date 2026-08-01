import { AlertTriangle } from "lucide-react";

/**
 * Persistent banner reminding users this is a hackathon MVP: rewards are
 * tracked in an internal database ledger, not distributed on-chain.
 */
export function TestnetBanner() {
  return (
    <div className="w-full border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-200">
      <span className="inline-flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3" />
        MVP · rewards are ledgered off-chain and non-monetary
      </span>
    </div>
  );
}
