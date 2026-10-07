import { keys, redis } from "@/lib/redis";
import { MuseumEntry } from "@/lib/rounds";

const PAGE = 24;

export async function GET(req: Request) {
  const page = Math.max(0, Number(new URL(req.url).searchParams.get("page") ?? 0) || 0);
  const r = redis();
  const [ids, total] = await Promise.all([
    r.zrange<string[]>(keys.museum, page * PAGE, page * PAGE + PAGE - 1, { rev: true }),
    r.zcard(keys.museum),
  ]);
  const entries = ids.length ? (await r.mget<(MuseumEntry | null)[]>(...ids.map((id) => keys.museumEntry(Number(id))))).filter(Boolean) : [];
  return Response.json({ entries, total, page, pageSize: PAGE }, { headers: { "cache-control": "no-store" } });
}
