import { after } from "next/server";
import { finalizePending, getEntry, getOrCreatePrompt, getPotLamports } from "@/lib/game";
import { keys, redis } from "@/lib/redis";
import { ROUND_MS, RoundFinal, Submission, roundAt, roundEnd, roundStart } from "@/lib/rounds";
import { isPaused } from "@/lib/paused";
import { lamportsToSol, treasuryAddress } from "@/lib/solana";

export const maxDuration = 300;

/** How long into a new round the critic's walkthrough of the previous round stays on stage. */
const SHOW_MS = 100_000;
/** Max pieces the critic walks past on stage. */
const STAGE_MAX = 24;

export async function GET() {
  const now = Date.now();
  const round = roundAt(now);
  const r = redis();

  after(() => finalizePending(now));
  if (roundEnd(round) - now < 45_000) after(() => getOrCreatePrompt(round + 1).then(() => undefined));

  const [prompt, entries, prevFinal, prevEntries, latestIds, pot] = await Promise.all([
    getOrCreatePrompt(round),
    r.llen(keys.subs(round)),
    r.get<RoundFinal>(keys.final(round - 1)),
    r.llen(keys.subs(round - 1)),
    r.zrange<string[]>(keys.museum, 0, 0, { rev: true }),
    getPotLamports(),
  ]);
  const pastRounds = Array.from({ length: 12 }, (_, i) => round - 1 - i);
  const [latest, pastPrompts] = await Promise.all([
    latestIds[0] ? getEntry(Number(latestIds[0])) : null,
    r.mget<(string | null)[]>(...pastRounds.map(keys.prompt)),
  ]);

  const prevStatus = prevFinal?.status ?? (prevEntries > 0 ? "judging" : "empty");
  let review = null;
  if (prevEntries > 0 && (prevStatus === "judging" || now - roundStart(round) < SHOW_MS)) {
    const ids = await r.lrange<string>(keys.subs(round - 1), 0, STAGE_MAX - 1);
    const [metas, remarks] = await Promise.all([
      r.mget<(Submission | null)[]>(...ids.map(keys.sub)),
      r.get<Record<string, string>>(keys.review(round - 1)),
    ]);
    const winner = prevStatus === "done" && latest?.round === round - 1 ? latest : null;
    review = {
      round: round - 1,
      total: prevEntries,
      entries: metas.filter((m): m is Submission => !!m).map((m) => ({ id: m.id, artist: m.artist, title: m.title })),
      remarks: remarks ?? {},
      winnerId: winner?.submissionId ?? null,
      winnerTitle: winner?.title ?? null,
      critique: winner?.critique ?? null,
    };
  }

  return Response.json(
    {
      now,
      roundMs: ROUND_MS,
      round: { id: round, start: roundStart(round), end: roundEnd(round), prompt, entries },
      previous: {
        id: round - 1,
        entries: prevEntries,
        status: prevStatus,
      },
      latest,
      review,
      pastPrompts: pastPrompts.filter((p): p is string => !!p),
      pot: { sol: lamportsToSol(pot), treasury: treasuryAddress() },
      paused: isPaused(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
