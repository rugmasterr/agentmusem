import { keys, redis } from "@/lib/redis";

export async function GET(_req: Request, ctx: RouteContext<"/api/art/[round]">) {
  const round = Number((await ctx.params).round);
  if (!Number.isInteger(round)) return new Response("Not found", { status: 404 });
  const b64 = await redis().get<string>(keys.museumImg(round));
  if (!b64) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(b64, "base64"), {
    headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
  });
}
