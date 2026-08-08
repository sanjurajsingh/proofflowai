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
/** Deployed on GenLayer Studionet, tx 0x463a03fe3405d579a78ae10fd2d5ec5147a0801611849e8903a0bdfd2ac3945f */
export const DEPLOYED_PROOFFLOW_ADDRESS = "0xEbF83c229b6B49880B6A2982028105a0C0DD22e2";

export const PROOFFLOW_CONTRACT_ADDRESS = ((import.meta.env[
  "VITE_PROOFFLOW_CONTRACT_ADDRESS"
] as string | undefined) || DEPLOYED_PROOFFLOW_ADDRESS) as `0x${string}`;

export const isContractConfigured = () => /^0x[0-9a-fA-F]{40}$/.test(PROOFFLOW_CONTRACT_ADDRESS);

export const explorerBaseUrl = () =>
  GENLAYER_NETWORK === "testnetAsimov"
    ? "https://explorer-asimov.genlayer.com"
    : GENLAYER_NETWORK === "testnetBradbury"
      ? "https://explorer-bradbury.genlayer.com"
      : "https://explorer-studio.genlayer.com";

export const explorerTxUrl = (hash: string) => `${explorerBaseUrl()}/tx/${hash}`;

export const NETWORK_LABEL =
  GENLAYER_NETWORK === "studionet"
    ? "GenLayer Studionet"
    : GENLAYER_NETWORK === "localnet"
      ? "GenLayer Localnet"
      : GENLAYER_NETWORK === "testnetAsimov"
        ? "GenLayer Asimov Testnet"
        : "GenLayer Bradbury Testnet";

export const FAUCET_URL = "https://testnet-faucet.genlayer.foundation";
