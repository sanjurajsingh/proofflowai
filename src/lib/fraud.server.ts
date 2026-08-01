// Server-only fraud-detection helpers. Never import from client code.
import { createHash } from "crypto";

export function hashContent(parts: Array<string | null | undefined>): string {
  const normalized = parts
    .map((p) => (p ?? "").toString().trim().toLowerCase())
    .filter(Boolean)
    .join("||");
  if (!normalized) return "";
  return createHash("sha256").update(normalized).digest("hex");
}

export function deviceFingerprint(ua: string | null, ip: string | null): string {
  return createHash("sha256")
    .update(`${ua ?? ""}::${ip ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

export function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase().trim();
}
