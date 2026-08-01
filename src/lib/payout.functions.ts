import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
import { supabaseAdmin } from "../integrations/supabase/client.server";

/**
 * Worker requests payout. Atomically debits wallet, ledgers it, creates payout_request.
 */
export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      amount: z.number().positive().max(1_000_000),
      destination: z.string().min(3).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = supabaseAdmin;
    const userId = context.userId;

    const { data: prof, error } = await sb
      .from("profiles").select("wallet_balance").eq("id", userId).single();
    if (error || !prof) throw new Error("Profile not found");

    const balance = Number(prof.wallet_balance);
    if (data.amount > balance) throw new Error("Insufficient balance");
    if (data.amount < 5) throw new Error("Minimum payout is $5");

    const newBalance = balance - data.amount;

    const { data: payout, error: pErr } = await sb.from("payout_requests").insert({
      user_id: userId,
      amount: data.amount,
      destination: data.destination,
      method: "manual",
      status: "pending",
    }).select().single();
    if (pErr) throw new Error(pErr.message);

    await sb.from("profiles").update({ wallet_balance: newBalance }).eq("id", userId);

    await sb.from("wallet_transactions").insert({
      user_id: userId,
      kind: "payout",
      amount: -data.amount,
      balance_after: newBalance,
      payout_request_id: payout.id,
      note: `Payout request to ${data.destination}`,
    });

    return { id: payout.id, newBalance };
  });

/**
 * Admin marks a payout request as paid (or rejected — refunds wallet).
 */
export const resolvePayoutRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["paid", "rejected"]),
      adminNote: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = supabaseAdmin;
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) throw new Error("Forbidden");

    const { data: payout, error } = await sb.from("payout_requests").select("*").eq("id", data.id).single();
    if (error || !payout) throw new Error("Payout not found");
    if (payout.status !== "pending") throw new Error("Payout already resolved");

    if (data.action === "rejected") {
      const { data: prof } = await sb.from("profiles").select("wallet_balance").eq("id", payout.user_id).single();
      const refunded = Number(prof?.wallet_balance ?? 0) + Number(payout.amount);
      await sb.from("profiles").update({ wallet_balance: refunded }).eq("id", payout.user_id);
      await sb.from("wallet_transactions").insert({
        user_id: payout.user_id,
        kind: "refund",
        amount: Number(payout.amount),
        balance_after: refunded,
        payout_request_id: payout.id,
        note: "Payout rejected — refunded",
      });
    }

    await sb.from("payout_requests").update({
      status: data.action,
      admin_note: data.adminNote ?? null,
      processed_at: new Date().toISOString(),
    }).eq("id", payout.id);

    return { ok: true };
  });
