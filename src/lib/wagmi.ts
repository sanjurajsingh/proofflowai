import { http } from "wagmi";
import { defineChain } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { GENLAYER_CHAIN, GENLAYER_NETWORK, explorerBaseUrl } from "@/lib/genlayer/config";

const rpcUrl =
  (GENLAYER_CHAIN as any)?.rpcUrls?.default?.http?.[0] ?? "https://studio.genlayer.com/api";

/**
 * Wallet chain is derived from the same GenLayer chain the SDK talks to, so the
 * wallet can never be connected to a different network than the contract reads.
 */
export const genlayerChain = defineChain({
  id: (GENLAYER_CHAIN as any).id as number,
  name: (GENLAYER_CHAIN as any).name ?? `GenLayer ${GENLAYER_NETWORK}`,
  nativeCurrency: { name: "GenLayer", symbol: "GEN", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: {
    default: { name: "GenLayer Explorer", url: explorerBaseUrl() },
  },
  testnet: true,
});

/** Back-compat alias. */
export const genlayerTestnet = genlayerChain;

export const wagmiConfig = getDefaultConfig({
  appName: "ProofFlow AI",
  projectId: "3a8170812b534d0ff9d794f19a901d64",
  chains: [genlayerChain],
  transports: {
    [genlayerChain.id]: http(rpcUrl),
  },
  ssr: false,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
