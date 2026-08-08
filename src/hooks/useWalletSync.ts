import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

function shortName(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Optional storage bridge. The wallet is the app identity; this only creates the
 * lightweight session that authorises proof-image uploads and stores optional
 * profile metadata. It never gates the UI and never disconnects the wallet:
 * if it fails, every GenLayer flow still works.
 */
export function useWalletSync() {
  const { user, loading } = useAuth();
  const { address, isConnected } = useAccount();
  const busy = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !isConnected || !address) return;
    const key = `${user?.id ?? "anon"}:${address.toLowerCase()}`;
    if (busy.current === key) return;
    busy.current = key;

    (async () => {
      try {
        let currentUser = user;
        if (!currentUser) {
          const { data } = await supabase.auth.signInAnonymously();
          currentUser = data?.user ?? null;
        }
        if (!currentUser) return;
        await supabase.from("profiles").upsert(
          {
            id: currentUser.id,
            wallet_address: address,
            display_name: shortName(address),
          },
          { onConflict: "id" },
        );
      } catch (e) {
        // Storage metadata is optional — never block the wallet-native flows.
        console.warn("[wallet-sync] optional metadata sync skipped", e);
      }
    })();
  }, [loading, user, isConnected, address]);
}
