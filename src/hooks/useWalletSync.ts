import { useEffect, useRef } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const SIGNED_KEY_PREFIX = "pf:wallet-sig:";
const SIGN_MESSAGE = (addr: string, nonce: string) =>
  `Welcome to ProofFlow AI\n\nSign this message to authenticate.\nThis does not trigger a blockchain transaction or cost any gas.\n\nWallet: ${addr}\nNonce: ${nonce}`;

function shortName(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Wallet-first auth bridge.
 *
 * On wallet connect:
 *   1. If no Supabase session → sign in anonymously.
 *   2. Prompt a one-time signature (cached in localStorage per address).
 *   3. Upsert profile row with wallet_address as primary identity.
 *
 * On wallet disconnect:
 *   - Sign out of Supabase so the app returns to a public state.
 */
export function useWalletSync() {
  const { user, loading } = useAuth();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const busy = useRef<string | null>(null);
  const prevConnected = useRef<boolean>(false);

  // 1. Wallet connected → ensure Supabase session + profile linked
  useEffect(() => {
    if (loading) return;
    if (!isConnected || !address) return;
    const key = `${user?.id ?? "anon"}:${address.toLowerCase()}`;
    if (busy.current === key) return;
    busy.current = key;

    (async () => {
      try {
        // Ensure session exists (anonymous)
        let currentUser = user;
        if (!currentUser) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          currentUser = data.user;
        }
        if (!currentUser) return;

        // One-time SIWE-style signature per address (client-side proof)
        const sigKey = `${SIGNED_KEY_PREFIX}${address.toLowerCase()}`;
        if (!localStorage.getItem(sigKey)) {
          const nonce = Math.random().toString(36).slice(2, 12);
          try {
            const sig = await signMessageAsync({ message: SIGN_MESSAGE(address, nonce) });
            localStorage.setItem(sigKey, `${nonce}:${sig.slice(0, 12)}`);
          } catch {
            // User declined; disconnect wallet to keep UX honest
            disconnect();
            busy.current = null;
            return;
          }
        }

        // Upsert profile (wallet_address is identity)
        await supabase
          .from("profiles")
          .upsert(
            {
              id: currentUser.id,
              wallet_address: address,
              display_name: shortName(address),
            },
            { onConflict: "id", ignoreDuplicates: false },
          );
      } catch (e) {
        console.warn("[wallet-auth] failed", e);
        busy.current = null;
      }
    })();
  }, [loading, user, isConnected, address, signMessageAsync, disconnect]);

  // 2. Track connect→disconnect transitions; sign out on disconnect
  useEffect(() => {
    const was = prevConnected.current;
    prevConnected.current = isConnected;
    if (was && !isConnected && user) {
      void supabase.auth.signOut();
    }
  }, [isConnected, user]);
}
