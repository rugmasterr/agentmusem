import { keys, redis } from "@/lib/redis";
import { MuseumEntry, RoundFinal, Submission, roundAt } from "@/lib/rounds";

/** Lists every entry for a round (defaults to the latest round with entries), plus recent rounds for navigation. */
export async function GET(req: Request) {
  const r = redis();
  const param = new URL(req.url).searchParams.get("round");
  const recentIds = (await r.zrange<string[]>(keys.activeRounds, 0, 29, { rev: true })).map(Number);
  const round = param !== null && Number.isInteger(Number(param)) ? Number(param) : recentIds[0];

  const recentPrompts = recentIds.length ? await r.mget<(string | null)[]>(...recentIds.map(keys.prompt)) : [];
  const recentCounts = await Promise.all(recentIds.map((id) => r.llen(keys.subs(id))));
  const rounds = recentIds.map((id, i) => ({ id, prompt: recentPrompts[i], entries: recentCounts[i] }));

  if (round === undefined) return Response.json({ round: null, rounds, current: roundAt(Date.now()) });

  const ids = await r.lrange<string>(keys.subs(round), 0, -1);
  const [prompt, final, winner, subs, remarks] = await Promise.all([
    r.get<string>(keys.prompt(round)),
    r.get<RoundFinal>(keys.final(round)),
    r.get<MuseumEntry>(keys.museumEntry(round)),
    ids.length ? r.mget<(Submission | null)[]>(...ids.map(keys.sub)) : Promise.resolve([]),
    r.get<Record<string, string>>(keys.review(round)),
  ]);
  const current = roundAt(Date.now());
  const status = round === current ? "open" : final?.status === "done" ? "done" : final ? "empty" : ids.length ? "judging" : "empty";

  return Response.json(
    {
      round: { id: round, prompt, status, winnerId: winner?.submissionId ?? null, winnerTitle: winner?.title ?? null },
      entries: subs.filter(Boolean).reverse(),
      remarks: remarks ?? {},
      rounds,
      current,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
