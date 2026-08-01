import { AlertTriangle } from "lucide-react";

/**
 * Persistent banner reminding users that all on-chain interactions
 * are GenLayer TESTNET ONLY. Voucher signatures use a deterministic
 * dev key until OPERATOR_PRIVATE_KEY is configured.
 */
export function TestnetBanner() {
  return (
    <div className="w-full border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-200">
      <span className="inline-flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3" />
        TESTNET ONLY · GenLayer testnet · all GEN rewards are non-monetary
      </span>
    </div>
  );
}
