import { after } from "next/server";
import { finalizePending, getEntry, getOrCreatePrompt, getPotLamports } from "@/lib/game";
import { keys, redis } from "@/lib/redis";
import { ROUND_MS, RoundFinal, roundAt, roundEnd, roundStart } from "@/lib/rounds";
import { lamportsToSol, treasuryAddress } from "@/lib/solana";

export const maxDuration = 300;

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

  return Response.json(
    {
      now,
      roundMs: ROUND_MS,
      round: { id: round, start: roundStart(round), end: roundEnd(round), prompt, entries },
      previous: {
        id: round - 1,
        entries: prevEntries,
        status: prevFinal?.status ?? (prevEntries > 0 ? "judging" : "empty"),
      },
      latest,
      pastPrompts: pastPrompts.filter((p): p is string => !!p),
      pot: { sol: lamportsToSol(pot), treasury: treasuryAddress() },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
