import { getVercelOidcToken } from "@vercel/oidc";

const GATEWAY = "https://ai-gateway.vercel.sh/v1/chat/completions";
const MODEL = process.env.CURATOR_MODEL ?? "anthropic/claude-sonnet-5.5";

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type Message = { role: "system" | "user"; content: string | Part[] };

async function authToken(): Promise<string> {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  return getVercelOidcToken();
}

async function chat(messages: Message[], maxTokens: number, timeoutMs: number): Promise<string> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await authToken()}` },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 1 }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function parseJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON in model output: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]) as T;
}

const CURATOR = `You are THE CURATOR, the eccentric AI director of the Agent Museum — a gallery that only exhibits art drawn by humans with a mouse or finger in 5 minutes on a tiny web canvas. You have refined, playful, slightly dramatic taste.`;

export async function generatePrompt(recent: string[]): Promise<string> {
  const text = await chat(
    [
      { role: "system", content: CURATOR },
      {
        role: "user",
        content: `Commission the next piece for the museum. Humans get 5 minutes and a simple brush/fill/eraser canvas, so it must be drawable fast but leave room for creativity and humor. Vary wildly between subjects, moods and styles (portraits, absurd scenarios, landscapes, abstract feelings, mythical creatures, self-portraits of you, etc).
Recently commissioned (do NOT repeat these themes):
${recent.map((p) => `- ${p}`).join("\n") || "- (none yet)"}

Reply ONLY with JSON: {"prompt": "<the commission, max 14 words, no quotes>"}`,
      },
    ],
    200,
    15000,
  );
  const prompt = parseJson<{ prompt: string }>(text).prompt?.trim();
  if (!prompt) throw new Error("Empty prompt");
  return prompt.slice(0, 140);
}

export type Verdict = { index: number; title: string; critique: string };

async function judgeBatch(prompt: string, images: string[], final: boolean): Promise<Verdict> {
  const parts: Part[] = [
    {
      type: "text",
      text: `Your commission was: "${prompt}".
${images.length} humans submitted drawings. They are numbered 1..${images.length} in order below. ${final ? "Pick ONE favorite to hang in the museum forever. Its artist gets paid." : "Pick the strongest one to advance to the final round."}
Judge on: how well it answers the commission, creativity, effort, humor and charm. Ignore blank, offensive or spam entries.`,
    },
  ];
  images.forEach((img, i) => {
    parts.push({ type: "text", text: `Drawing #${i + 1}:` });
    parts.push({ type: "image_url", image_url: { url: img } });
  });
  parts.push({
    type: "text",
    text: `Reply ONLY with JSON: {"winner": <number 1-${images.length}>, "title": "<a gallery placard title for the winning piece, max 6 words>", "critique": "<your curator's note on why it won, 1-2 vivid sentences>"}`,
  });
  const text = await chat([{ role: "system", content: CURATOR }, { role: "user", content: parts }], 400, 90000);
  const v = parseJson<{ winner: number; title: string; critique: string }>(text);
  const index = Math.min(Math.max(Math.round(Number(v.winner)) - 1, 0), images.length - 1);
  return { index, title: String(v.title ?? "Untitled").slice(0, 80), critique: String(v.critique ?? "").slice(0, 400) };
}

const BATCH = 16;

/** Judges any number of drawings: batches of BATCH pick semifinalists, then a final round picks the winner. */
export async function judge(prompt: string, images: string[]): Promise<Verdict> {
  if (images.length === 1) {
    const v = await judgeBatch(prompt, images, true);
    return { ...v, index: 0 };
  }
  if (images.length <= BATCH) return judgeBatch(prompt, images, true);
  const groups: number[][] = [];
  for (let i = 0; i < images.length; i += BATCH) groups.push(images.slice(i, i + BATCH).map((_, j) => i + j));
  const semis = await Promise.all(
    groups.map(async (g) => g[(await judgeBatch(prompt, g.map((i) => images[i]), false)).index]),
  );
  const v = await judgeBatch(prompt, semis.map((i) => images[i]), true);
  return { ...v, index: semis[v.index] };
}

export const FALLBACK_PROMPTS = [
  "A cat running a tiny coffee shop",
  "Your hometown, but underwater",
  "A dragon who is afraid of the dark",
  "The last sunset on Mars",
  "A self-portrait of the Curator (that's me)",
  "A sandwich with an unreasonable number of layers",
  "Two robots falling in love",
  "The feeling of Monday morning",
  "A frog king on his lily-pad throne",
  "A haunted vending machine",
  "An astronaut lost in a supermarket",
  "The moon taking a day off",
  "A wizard's messy kitchen",
  "A whale flying over a city",
  "The world's smallest superhero",
  "A ghost trying to make friends",
  "A volcano having a birthday party",
  "Dinosaurs at the beach",
  "A portrait of your favorite meme",
  "A city built on the back of a turtle",
  "A snowman on vacation in the desert",
  "A knight fighting a very small dragon",
  "What dreams look like from the inside",
  "A penguin's first day at a new job",
  "The scariest possible houseplant",
  "Aliens discovering pizza",
  "A lighthouse in a storm",
  "An octopus doing eight things at once",
  "A mushroom village at night",
  "The ocean's secret party",
];
