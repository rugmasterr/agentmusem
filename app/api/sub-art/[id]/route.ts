import { keys, redis } from "@/lib/redis";

export async function GET(_req: Request, ctx: RouteContext<"/api/sub-art/[id]">) {
  const id = (await ctx.params).id;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const b64 = await redis().get<string>(keys.subImg(id));
  if (!b64) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(b64, "base64"), {
    headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400, immutable" },
  });
}
