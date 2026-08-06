import { localnet, studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";

export type GenLayerNetwork = "localnet" | "studionet" | "testnetAsimov" | "testnetBradbury";

export const GENLAYER_CHAINS = {
  localnet,
  studionet,
  testnetAsimov,
  testnetBradbury,
} as const;

/** Network name understood by both `genlayer-js/chains` and `client.connect()`. */
export const GENLAYER_NETWORK: GenLayerNetwork =
  (import.meta.env["VITE_GENLAYER_NETWORK"] as GenLayerNetwork | undefined) ?? "studionet";

export const GENLAYER_CHAIN = GENLAYER_CHAINS[GENLAYER_NETWORK] ?? studionet;

/** Deployed ProofFlow Intelligent Contract address (set after `genlayer deploy`). */
export const PROOFFLOW_CONTRACT_ADDRESS = (import.meta.env[
  "VITE_PROOFFLOW_CONTRACT_ADDRESS"
] ?? "") as `0x${string}` | "";

export const isContractConfigured = () => /^0x[0-9a-fA-F]{40}$/.test(PROOFFLOW_CONTRACT_ADDRESS);

export const explorerTxUrl = (hash: string) => {
  const base =
    GENLAYER_NETWORK === "testnetAsimov"
      ? "https://explorer-asimov.genlayer.com"
      : GENLAYER_NETWORK === "testnetBradbury"
        ? "https://explorer-bradbury.genlayer.com"
        : "https://explorer-studio.genlayer.com";
  return `${base}/tx/${hash}`;
};

export const FAUCET_URL = "https://testnet-faucet.genlayer.foundation";
