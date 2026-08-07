import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
const addr = "0xEbF83c229b6B49880B6A2982028105a0C0DD22e2" as const;
const c = createClient({ chain: studionet });
for (const fn of ["get_admin","get_campaigns","get_pending_payouts"]) {
  try { console.log(fn, JSON.stringify(await c.readContract({ address: addr, functionName: fn, args: [] as never }))); }
  catch (e:any) { console.log(fn, "ERR", e.message); }
}
