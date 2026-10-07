import { FALLBACK_PROMPTS, generatePrompt, judge } from "./ai";
import { keys, redis } from "./redis";
import { MuseumEntry, RoundFinal, Submission, roundAt } from "./rounds";
import { MIN_PAYOUT_LAMPORTS, claimCreatorFees, potLamports, sendPayout, treasury } from "./solana";

const SUB_TTL = 60 * 60 * 24 * 3;

/** Returns the round's commission, generating it (once, under a lock) if needed. Null while another request generates it. */
export async function getOrCreatePrompt(round: number): Promise<string | null> {
  const r = redis();
  const existing = await r.get<string>(keys.prompt(round));
  if (existing) return existing;
  const locked = await r.set(keys.promptLock(round), 1, { nx: true, ex: 30 });
  if (!locked) return null;
  let prompt: string;
  try {
    const recent = await r.lrange<string>(keys.recentPrompts, 0, 19);
    prompt = await generatePrompt(recent);
  } catch (e) {
    console.error("prompt generation failed, using fallback:", e);
    prompt = FALLBACK_PROMPTS[((round % FALLBACK_PROMPTS.length) + FALLBACK_PROMPTS.length) % FALLBACK_PROMPTS.length];
  }
  const set = await r.set(keys.prompt(round), prompt, { nx: true, ex: 60 * 60 * 24 * 30 });
  if (set) {
    await r.lpush(keys.recentPrompts, prompt);
    await r.ltrim(keys.recentPrompts, 0, 49);
  }
  return (await r.get<string>(keys.prompt(round))) ?? prompt;
}

/** Pot is cached briefly so polling clients don't hammer the RPC. */
export async function getPotLamports(): Promise<number> {
  if (!treasury()) return 0;
  const r = redis();
  const cached = await r.get<number>(keys.potCache);
  if (cached !== null) return cached;
  try {
    const pot = await potLamports();
    await r.set(keys.potCache, pot, { ex: 15 });
    return pot;
  } catch (e) {
    console.error("pot lookup failed:", e);
    return 0;
  }
}

export async function getEntry(round: number): Promise<MuseumEntry | null> {
  return redis().get<MuseumEntry>(keys.museumEntry(round));
}

async function finalizeRound(round: number): Promise<void> {
  const r = redis();
  if (await r.get(keys.final(round))) return;
  if (!(await r.set(keys.finalLock(round), 1, { nx: true, ex: 280 }))) return;

  const ids = await r.lrange<string>(keys.subs(round), 0, -1);
  if (ids.length === 0) {
    await r.set(keys.final(round), { status: "empty" } satisfies RoundFinal);
    return;
  }

  const metas = (await r.mget<(Submission | null)[]>(...ids.map(keys.sub))).filter((s): s is Submission => !!s);
  const imgs = await r.mget<(string | null)[]>(...metas.map((s) => keys.subImg(s.id)));
  const subs = metas.map((s, i) => ({ s, img: imgs[i] })).filter((x): x is { s: Submission; img: string } => !!x.img);
  if (subs.length === 0) {
    await r.set(keys.final(round), { status: "empty" } satisfies RoundFinal);
    return;
  }

  const prompt = (await r.get<string>(keys.prompt(round))) ?? "Anything at all";
  let verdict;
  try {
    verdict = await judge(prompt, subs.map((x) => `data:image/jpeg;base64,${x.img}`));
  } catch (e) {
    console.error("judging failed, picking by lot:", e);
    verdict = {
      index: Math.abs(round * 2654435761) % subs.length,
      title: "Untitled (Chosen by Fate)",
      critique: "The Curator's circuits overheated while deliberating, so fate itself hung this piece.",
      comments: [] as string[],
    };
  }
  const winner = subs[verdict.index];
  const remarks = Object.fromEntries(subs.map((x, i) => [x.s.id, verdict.comments[i] ?? ""]).filter(([, c]) => c));
  await r.set(keys.review(round), remarks, { ex: SUB_TTL * 5 });

  const entry: MuseumEntry = {
    round,
    prompt,
    submissionId: winner.s.id,
    artist: winner.s.artist,
    wallet: winner.s.wallet,
    title: winner.s.title ? `${winner.s.title}` : verdict.title,
    critique: verdict.critique,
    entries: subs.length,
    finalizedAt: Date.now(),
    payout: { status: "pending" },
  };
  await r.set(keys.museumImg(round), winner.img);
  await r.set(keys.museumEntry(round), entry);
  await r.zadd(keys.museum, { score: round, member: String(round) });
  await r.set(keys.final(round), { status: "done" } satisfies RoundFinal);

  entry.payout = await payWinner(round, entry);
  await r.set(keys.museumEntry(round), entry);
  await r.del(keys.potCache);
}

async function payWinner(round: number, entry: MuseumEntry): Promise<MuseumEntry["payout"]> {
  const r = redis();
  if (!treasury()) return { status: "skipped", note: "Treasury not configured" };
  try {
    await claimCreatorFees();
    const lamports = await potLamports();
    if (lamports < MIN_PAYOUT_LAMPORTS) return { status: "skipped", lamports, note: "Pot too small — rolls over" };
    const signature = await sendPayout(entry.wallet, lamports, async (sig) => {
      await r.set(keys.museumEntry(round), { ...entry, payout: { status: "pending", lamports, signature: sig } });
    });
    return { status: "sent", lamports, signature };
  } catch (e) {
    console.error(`payout for round ${round} failed:`, e);
    const pending = await getEntry(round);
    return { status: "failed", lamports: pending?.payout.lamports, signature: pending?.payout.signature, note: String(e).slice(0, 200) };
  }
}

/** Finalizes (judge + hang + pay) any of the last few rounds that ended without being finalized. */
export async function finalizePending(now = Date.now()): Promise<void> {
  const current = roundAt(now);
  const rounds = [current - 1, current - 2, current - 3];
  const finals = await redis().mget<(RoundFinal | null)[]>(...rounds.map(keys.final));
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (!finals[i]) await finalizeRound(rounds[i]);
  }
}
