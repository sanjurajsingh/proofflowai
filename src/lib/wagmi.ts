import { http } from "wagmi";
import { defineChain } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

// GenLayer testnet (zkSync OS based) — chainId 4221
export const genlayerTestnet = defineChain({
  id: 4221,
  name: "GenLayer Testnet",
  nativeCurrency: { name: "GenLayer", symbol: "GEN", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://zksync-os-testnet-genlayer.zksync.dev"] },
  },
  blockExplorers: {
    default: {
      name: "GenLayer Explorer",
      url: "https://zksync-os-testnet-genlayer.explorer.zksync.dev",
    },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName: "ProofFlow AI",
  projectId: "3a8170812b534d0ff9d794f19a901d64",
  chains: [genlayerTestnet],
  transports: {
    [genlayerTestnet.id]: http(),
  },
  ssr: false,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
