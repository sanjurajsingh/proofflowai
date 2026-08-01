import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
import { supabaseAdmin } from "../integrations/supabase/client.server";

const schema = z.object({ path: z.string().min(1).max(500) });

/**
 * Generate a short-lived signed URL for a private proof file.
 * Access: file owner, the campaign brand, or any admin.
 */
export const getSignedProofUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = supabaseAdmin;
    const userId = context.userId;
    const ownerId = data.path.split("/")[0];

    // Authorization: owner OR admin OR brand of a campaign that has this file in a submission
    let authorized = ownerId === userId;
    if (!authorized) {
      const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
      authorized = !!roles?.some((r) => r.role === "admin");
    }
    if (!authorized) {
      const { data: sub } = await sb
        .from("submissions")
        .select("campaign_id, campaigns(brand_id)")
        .eq("proof_image_url", data.path)
        .maybeSingle();
      const brandId = (sub?.campaigns as any)?.brand_id;
      authorized = brandId === userId;
    }
    if (!authorized) throw new Error("Forbidden");

    const { data: signed, error } = await sb.storage
      .from("proofs")
      .createSignedUrl(data.path, 60 * 5);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
