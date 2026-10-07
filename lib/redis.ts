import { Redis } from "@upstash/redis";

let client: Redis | null = null;

export function redis(): Redis {
  if (!client) {
    const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error("Redis is not configured (KV_REST_API_URL / KV_REST_API_TOKEN)");
    client = new Redis({ url, token });
  }
  return client;
}

export const keys = {
  prompt: (r: number) => `round:${r}:prompt`,
  promptLock: (r: number) => `round:${r}:prompt:lock`,
  subs: (r: number) => `round:${r}:subs`,
  walletSlot: (r: number, wallet: string) => `round:${r}:wallet:${wallet}`,
  ipCount: (r: number, ip: string) => `round:${r}:ip:${ip}`,
  final: (r: number) => `round:${r}:final`,
  finalLock: (r: number) => `round:${r}:final:lock`,
  sub: (id: string) => `sub:${id}`,
  subImg: (id: string) => `sub:${id}:img`,
  museum: "museum",
  museumEntry: (r: number) => `museum:${r}`,
  museumImg: (r: number) => `museum:${r}:img`,
  recentPrompts: "prompts:recent",
  potCache: "pot:cache",
  /** Sorted set of rounds that received at least one submission. */
  activeRounds: "rounds:active",
};
