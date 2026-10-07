import { headers } from "next/headers";
import { keys, redis } from "@/lib/redis";
import { GRACE_MS, Submission, roundAt, roundEnd } from "@/lib/rounds";
import { isValidWallet } from "@/lib/solana";

const TTL = 60 * 60 * 24 * 3;
const PREFIX = "data:image/jpeg;base64,";
const MAX_IMAGE_CHARS = 700_000;

const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const now = Date.now();
  let body: { round?: number; artist?: string; title?: string; wallet?: string; image?: string };
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request");
  }

  const round = Number(body.round);
  const current = roundAt(now);
  const open = round === current || (round === current - 1 && now < roundEnd(round) + GRACE_MS);
  if (!Number.isInteger(round) || !open) return bad("This round is closed — the Curator is already judging.", 409);

  const artist = String(body.artist ?? "").trim().slice(0, 32);
  const title = String(body.title ?? "").trim().slice(0, 48);
  const wallet = String(body.wallet ?? "").trim();
  const image = String(body.image ?? "");
  if (!artist) return bad("Sign your work — enter an artist name.");
  if (!isValidWallet(wallet)) return bad("That doesn't look like a valid Solana wallet address.");
  if (!image.startsWith(PREFIX) || image.length > MAX_IMAGE_CHARS) return bad("Invalid drawing.");

  const r = redis();
  if (await r.get(keys.final(round))) return bad("This round is closed — the Curator is already judging.", 409);

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipKey = keys.ipCount(round, ip);
  const count = await r.incr(ipKey);
  if (count === 1) await r.expire(ipKey, 900);
  if (count > 5) return bad("Too many submissions from your network this round.", 429);

  if (!(await r.set(keys.walletSlot(round, wallet), 1, { nx: true, ex: 900 })))
    return bad("This wallet already submitted a piece this round.", 409);

  const sub: Submission = { id: crypto.randomUUID(), round, artist, title, wallet, createdAt: now };
  await Promise.all([
    r.set(keys.sub(sub.id), sub, { ex: TTL }),
    r.set(keys.subImg(sub.id), image.slice(PREFIX.length), { ex: TTL }),
  ]);
  await r.rpush(keys.subs(round), sub.id);
  await r.expire(keys.subs(round), TTL);

  return Response.json({ ok: true, id: sub.id });
}
