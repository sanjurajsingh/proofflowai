import { createClient } from "genlayer-js";
import { TransactionStatus } from "genlayer-js/types";
import {
  GENLAYER_CHAIN,
  GENLAYER_NETWORK,
  PROOFFLOW_CONTRACT_ADDRESS,
  isContractConfigured,
} from "./config";

type Address = `0x${string}`;
type GenLayerClient = ReturnType<typeof createClient>;

let cached: { account: string; client: GenLayerClient } | null = null;

/**
 * Client bound to the connected browser wallet address.
 * `connect()` makes the wallet switch to the GenLayer network before any write.
 */
export async function getGenLayerClient(account: Address): Promise<GenLayerClient> {
  if (cached && cached.account === account) return cached.client;
  const client = createClient({ chain: GENLAYER_CHAIN, account });
  await client.connect(GENLAYER_NETWORK);
  cached = { account, client };
  return client;
}

/** Read-only client — no wallet required, used for public views. */
let readClient: GenLayerClient | null = null;
export function getReadClient(): GenLayerClient {
  if (!readClient) readClient = createClient({ chain: GENLAYER_CHAIN });
  return readClient;
}

function contract(): Address {
  if (!isContractConfigured()) {
    throw new Error(
      "ProofFlow contract address is not configured. Deploy contracts/proofflow.py and set VITE_PROOFFLOW_CONTRACT_ADDRESS.",
    );
  }
  return PROOFFLOW_CONTRACT_ADDRESS as Address;
}

/** Call a `@gl.public.view` method. Free, no wallet, no gas. */
export async function readMethod<T = unknown>(functionName: string, args: unknown[] = []) {
  const client = getReadClient();
  const result = await client.readContract({
    address: contract(),
    functionName,
    args: args as never,
  });
  return result as T;
}

export interface WriteOptions {
  /** Wait until this consensus state before resolving. */
  status?: TransactionStatus;
  value?: bigint;
}

/** Call a `@gl.public.write` method and wait for consensus. */
export async function writeMethod(
  account: Address,
  functionName: string,
  args: unknown[] = [],
  opts: WriteOptions = {},
) {
  const client = await getGenLayerClient(account);
  const hash = await client.writeContract({
    address: contract(),
    functionName,
    args: args as never,
    value: opts.value ?? BigInt(0),
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: opts.status ?? TransactionStatus.ACCEPTED,
  });
  return { hash, receipt };
}

export { TransactionStatus };
