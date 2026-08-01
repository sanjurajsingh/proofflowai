/**
 * Server function: sign an EIP-712 ClaimVoucher for an approved submission.
 *
 * Returns a voucher the worker submits to RewardVault.claim() from their
 * own wallet. When the vault is not yet deployed, this still issues a
 * voucher so the simulated claim path remains functional and testable.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { keccak256, toBytes, pad } from "viem";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";

const inputSchema = z.object({ submissionId: z.string().uuid() });

function uuidToBytes32(uuid: string): `0x${string}` {
  // Pack 16 bytes of UUID into a left-padded bytes32
  const hex = uuid.replace(/-/g, "");
  return pad(`0x${hex}` as `0x${string}`, { size: 32, dir: "left" });
}

export const signClaimVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getOperatorAccount, getOperatorAddress } = await import("./operator.server");
    const { EIP712_DOMAIN, CLAIM_TYPES, REWARD_VAULT_DEPLOYED } =
      await import("./contracts/config");

    // Verify submission is approved and owned by caller
    const { data: sub, error } = await supabase
      .from("submissions")
      .select("id, user_id, campaign_id, status, claim_status, campaigns(reward_amount, brand_id)")
      .eq("id", data.submissionId)
      .single();
    if (error || !sub) throw new Error("Submission not found");
    if (sub.user_id !== userId) throw new Error("Not your submission");
    if (sub.status !== "approved" && sub.status !== "paid") {
      throw new Error("Submission is not approved");
    }
    if (sub.claim_status === "paid") throw new Error("Already claimed");

    // Worker wallet address
    const { data: profile } = await supabase
      .from("profiles").select("wallet_address").eq("id", userId).single();
    if (!profile?.wallet_address) throw new Error("Connect a wallet first");
    const worker = profile.wallet_address as `0x${string}`;

    const amountGen = Number((sub.campaigns as any)?.reward_amount ?? 0);
    if (amountGen <= 0) throw new Error("Invalid reward amount");
    const amountWei = BigInt(Math.round(amountGen * 1e18));

    const nonce = keccak256(toBytes(`${sub.id}:${Date.now()}:${Math.random()}`));
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 30); // 30 min

    const message = {
      campaignId: uuidToBytes32(sub.campaign_id),
      submissionId: uuidToBytes32(sub.id),
      worker,
      amount: amountWei,
      deadline,
      nonce,
    } as const;

    const account = getOperatorAccount();
    const signature = await account.signTypedData({
      domain: EIP712_DOMAIN,
      types: CLAIM_TYPES,
      primaryType: "ClaimVoucher",
      message,
    });

    return {
      // TESTNET ONLY voucher
      testnetOnly: true,
      vaultDeployed: REWARD_VAULT_DEPLOYED,
      operator: getOperatorAddress(),
      voucher: {
        campaignId: message.campaignId,
        submissionId: message.submissionId,
        worker,
        amount: amountWei.toString(),
        deadline: deadline.toString(),
        nonce: message.nonce,
      },
      signature,
    };
  });
