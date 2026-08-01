import { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Renders a private proof file via a short-lived signed URL.
 * The bucket is private — never use getPublicUrl.
 */
export function ProofImage({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null); setError(false);
    supabase.storage.from("proofs").createSignedUrl(path, 60 * 5)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) setError(true);
        else setUrl(data.signedUrl);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [path]);

  if (error) return <span className="text-xs text-muted-foreground">(image unavailable)</span>;
  if (!url) return <span className="text-xs text-muted-foreground">Loading image…</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={className}>
      <img src={url} alt="proof" className="max-h-48 rounded-lg border border-border/40" />
    </a>
  );
}

export function ProofImageLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading}
      className="inline-flex items-center gap-1 text-primary hover:underline"
      onClick={async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase.storage.from("proofs").createSignedUrl(path, 60 * 5);
          if (error || !data?.signedUrl) throw error;
          window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        } finally { setLoading(false); }
      }}
    >
      <ImageIcon className="h-3 w-3" />{loading ? "Opening…" : "View image"}
    </button>
  );
}
