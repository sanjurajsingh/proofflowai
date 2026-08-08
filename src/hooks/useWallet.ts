import { useAccount, useSwitchChain } from "wagmi";
import { genlayerChain } from "@/lib/wagmi";
import type { Address } from "@/lib/genlayer/proofflow";

/**
 * Single source of truth for wallet state across the whole app.
 * Every page reads connection + network from here so the UI can never
 * disagree with the wallet that signs GenLayer transactions.
 */
export function useWallet() {
  const { address, isConnected, isConnecting, isReconnecting, chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();

  const ready = !isConnecting && !isReconnecting;
  const wrongNetwork = !!isConnected && chainId !== undefined && chainId !== genlayerChain.id;

  return {
    address: (address ?? null) as Address | null,
    isConnected: !!isConnected && !!address,
    ready,
    chainId,
    wrongNetwork,
    switching,
    expectedChain: genlayerChain,
    switchToGenLayer: () => switchChain({ chainId: genlayerChain.id }),
    /** True when a contract write is safe to attempt. */
    canTransact: !!isConnected && !!address && !wrongNetwork,
  };
}
