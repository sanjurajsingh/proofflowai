/**
 * RewardVault contract configuration.
 *
 * TESTNET ONLY — when a deployed address is configured, claims go on-chain
 * via the user's wallet. Until then, claims fall back to a simulated tx
 * hash so the full UX is testable end-to-end without a deployment.
 *
 * To go live:
 *   1. Deploy `src/lib/contracts/RewardVault.sol` to GenLayer testnet.
 *   2. Set VITE_REWARD_VAULT_ADDRESS in the environment.
 *   3. Set OPERATOR_PRIVATE_KEY as a runtime secret (see operator.server.ts).
 */
import { genlayerTestnet } from "@/lib/wagmi";

const RAW_ADDRESS =
  (import.meta.env.VITE_REWARD_VAULT_ADDRESS as string | undefined)?.trim() ?? "";

export const REWARD_VAULT_ADDRESS = (
  RAW_ADDRESS && /^0x[a-fA-F0-9]{40}$/.test(RAW_ADDRESS) ? RAW_ADDRESS : ""
) as `0x${string}` | "";

export const REWARD_VAULT_DEPLOYED = REWARD_VAULT_ADDRESS !== "";

export const REWARD_VAULT_CHAIN_ID = genlayerTestnet.id;

export const EIP712_DOMAIN = {
  name: "ProofFlowRewardVault",
  version: "1",
  chainId: REWARD_VAULT_CHAIN_ID,
  verifyingContract: (REWARD_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
} as const;

export const CLAIM_TYPES = {
  ClaimVoucher: [
    { name: "campaignId", type: "bytes32" },
    { name: "submissionId", type: "bytes32" },
    { name: "worker", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export const REWARD_VAULT_ABI = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "campaignId", type: "bytes32" },
      { name: "submissionId", type: "bytes32" },
      { name: "worker", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "fundCampaign",
    stateMutability: "payable",
    inputs: [{ name: "campaignId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "campaignBalance",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
