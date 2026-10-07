import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

/** Kept in the treasury to stay rent-exempt and cover tx fees. */
const RESERVE_LAMPORTS = Math.round(Number(process.env.TREASURY_RESERVE_SOL ?? "0.003") * LAMPORTS_PER_SOL);
/** Below this the pot rolls over to the next round (new accounts need ~0.00089 SOL to be rent-exempt). */
export const MIN_PAYOUT_LAMPORTS = Math.round(Number(process.env.MIN_PAYOUT_SOL ?? "0.001") * LAMPORTS_PER_SOL);
const PAYOUT_PERCENT = Math.min(Math.max(Number(process.env.PAYOUT_PERCENT ?? "100"), 0), 100);

export function connection() {
  return new Connection(process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com", "confirmed");
}

export function treasury(): Keypair | null {
  const raw = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!raw) return null;
  const bytes = raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw);
  return Keypair.fromSecretKey(bytes);
}

export function treasuryAddress(): string | null {
  return process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? treasury()?.publicKey.toBase58() ?? null;
}

export function isValidWallet(addr: string): boolean {
  try {
    return PublicKey.isOnCurve(new PublicKey(addr).toBytes());
  } catch {
    return false;
  }
}

/** Lamports currently available to pay out to a winner. */
export async function potLamports(): Promise<number> {
  const kp = treasury();
  if (!kp) return 0;
  const balance = await connection().getBalance(kp.publicKey);
  return Math.max(0, Math.floor(((balance - RESERVE_LAMPORTS) * PAYOUT_PERCENT) / 100));
}

/** Best-effort: claim pump.fun creator fees into the treasury before paying out. Enabled with CLAIM_PUMP_FEES=true. */
export async function claimCreatorFees(): Promise<void> {
  const kp = treasury();
  if (!kp || process.env.CLAIM_PUMP_FEES !== "true") return;
  try {
    const res = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicKey: kp.publicKey.toBase58(), action: "collectCreatorFee", priorityFee: 0.000001 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`pumpportal ${res.status}: ${await res.text()}`);
    const tx = VersionedTransaction.deserialize(new Uint8Array(await res.arrayBuffer()));
    tx.sign([kp]);
    const conn = connection();
    const sig = await conn.sendTransaction(tx, { maxRetries: 3 });
    const bh = await conn.getLatestBlockhash();
    await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  } catch (e) {
    console.warn("creator fee claim failed (continuing):", e);
  }
}

/**
 * Sends `lamports` from the treasury to `to`. `onSigned` receives the signature before broadcast
 * so it can be persisted even if confirmation times out.
 */
export async function sendPayout(to: string, lamports: number, onSigned: (sig: string) => Promise<void>): Promise<string> {
  const kp = treasury();
  if (!kp) throw new Error("Treasury not configured");
  const conn = connection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: kp.publicKey, blockhash, lastValidBlockHeight }).add(
    SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(to), lamports }),
  );
  tx.sign(kp);
  const sig = bs58.encode(tx.signature!);
  await onSigned(sig);
  await conn.sendRawTransaction(tx.serialize(), { maxRetries: 5 });
  const result = await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (result.value.err) throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
  return sig;
}

export const lamportsToSol = (l: number) => l / LAMPORTS_PER_SOL;
