import { finalizePending, getOrCreatePrompt } from "@/lib/game";
import { roundAt } from "@/lib/rounds";

export const maxDuration = 300;

/** Hit by an external pinger so rounds are judged and paid on time even with no visitors. */
export async function GET() {
  const now = Date.now();
  await Promise.all([finalizePending(now), getOrCreatePrompt(roundAt(now))]);
  return Response.json({ ok: true, round: roundAt(now) });
}
