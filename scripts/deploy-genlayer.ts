import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { readFileSync } from "fs";

const pk = process.env.GL_PK || generatePrivateKey();
const account = createAccount(pk as `0x${string}`);
console.log("PK", pk);
console.log("ADDR", account.address);
const client = createClient({ chain: studionet, account });
const code = readFileSync("contracts/proofflow.py");
try { const f = await (client as any).fundAccount?.({ address: account.address, amount: 10n**20n }); console.log("funded", f); } catch(e:any) { console.log("fund err", e.message); }
const tx = await client.deployContract({ code: code.toString(), args: [], leaderOnly: false } as any);
console.log("TX", tx);
const receipt = await client.waitForTransactionReceipt({ hash: tx as any, status: TransactionStatus.FINALIZED, retries: 200, interval: 3000 });
console.log("STATUS", (receipt as any)?.status, "ADDR", (receipt as any)?.data?.contract_address ?? (receipt as any)?.contract_address ?? JSON.stringify(receipt).slice(0,800));
