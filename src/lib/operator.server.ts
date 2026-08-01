/**
 * TESTNET ONLY operator signer for EIP-712 reward vouchers.
 *
 * Reads OPERATOR_PRIVATE_KEY from the runtime environment when set.
 * Falls back to the well-known Anvil dev key (account #0) when not set,
 * so local + preview environments work without ceremony.
 *
 * BEFORE PRODUCTION: set OPERATOR_PRIVATE_KEY as a real secret and ensure
 * the corresponding address is the `operator` configured on the deployed
 * RewardVault contract.
 */
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

// Anvil account #0 — public, well-known, NEVER use beyond local/dev/testnet.
const DEV_FALLBACK_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

let _account: PrivateKeyAccount | undefined;

export function getOperatorAccount(): PrivateKeyAccount {
  if (_account) return _account;
  const raw = (process.env.OPERATOR_PRIVATE_KEY ?? "").trim();
  const key = raw && /^0x[0-9a-fA-F]{64}$/.test(raw) ? raw : DEV_FALLBACK_KEY;
  if (key === DEV_FALLBACK_KEY) {
    console.warn(
      "[operator] TESTNET ONLY — using deterministic dev key. " +
        "Set OPERATOR_PRIVATE_KEY before production.",
    );
  }
  _account = privateKeyToAccount(key as `0x${string}`);
  return _account;
}

export function getOperatorAddress(): `0x${string}` {
  return getOperatorAccount().address;
}
