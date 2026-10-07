"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DrawingCanvas, { CanvasHandle } from "@/components/DrawingCanvas";
import { FramedArt, shortAddr } from "@/components/Placard";
import type { MuseumEntry } from "@/lib/rounds";

type State = {
  now: number;
  roundMs: number;
  round: { id: number; start: number; end: number; prompt: string | null; entries: number };
  previous: { id: number; entries: number; status: "judging" | "empty" | "done" };
  latest: MuseumEntry | null;
  pot: { sol: number; treasury: string | null };
};

const GRACE_MS = 5000;

function load(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function save(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {}
}

export default function Studio() {
  const [state, setState] = useState<State | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(0);
  const [artist, setArtist] = useState("");
  const [wallet, setWallet] = useState("");
  const [title, setTitle] = useState("");
  const [submittedRound, setSubmittedRound] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const canvas = useRef<CanvasHandle>(null);
  const roundRef = useRef<number | null>(null);

  useEffect(() => {
    setArtist(load("artist"));
    setWallet(load("wallet"));
  }, []);

  const poll = useCallback(async () => {
    try {
      const t0 = Date.now();
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return;
      const s: State = await res.json();
      const t1 = Date.now();
      setOffset(s.now - (t0 + t1) / 2);
      setState(s);
      if (roundRef.current !== null && roundRef.current !== s.round.id) {
        canvas.current?.reset();
        setTitle("");
        setMsg(null);
      }
      roundRef.current = s.round.id;
    } catch {}
  }, []);

  useEffect(() => {
    poll();
    const p = setInterval(poll, 3000);
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => {
      clearInterval(p);
      clearInterval(t);
    };
  }, [poll]);

  const serverNow = now + offset;
  const remaining = state ? Math.max(0, state.round.end - serverNow) : 0;
  const closed = state ? serverNow > state.round.end + GRACE_MS : false;
  const submitted = state && submittedRound === state.round.id;
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const urgent = remaining < 30_000;
  const progress = state ? 1 - remaining / state.roundMs : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!state || !canvas.current) return;
    if (canvas.current.isBlank()) return setMsg({ ok: false, text: "The canvas is empty — draw something first!" });
    setBusy(true);
    setMsg(null);
    save("artist", artist);
    save("wallet", wallet);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ round: state.round.id, artist, title, wallet, image: canvas.current.toJpeg() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setSubmittedRound(state.round.id);
      setMsg({ ok: true, text: "Submitted! The Curator will judge when the timer hits zero." });
      poll();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6">
      {/* Commission banner */}
      <section className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-1 bg-white/5">
          <div className={`h-full transition-[width] duration-200 ${urgent ? "bg-red-500" : "bg-[var(--gold)]"}`} style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gold)]">
              The Curator requests · Round #{state?.round.id ?? "…"}
            </div>
            <h1 className="mt-2 font-serif text-3xl leading-tight sm:text-5xl">
              {state?.round.prompt ? `“${state.round.prompt}”` : <span className="animate-pulse text-[var(--muted)]">The Curator is thinking…</span>}
            </h1>
          </div>
          <div className="flex shrink-0 items-end gap-6">
            <Stat label="Pot" value={`${(state?.pot.sol ?? 0).toFixed(3)} SOL`} />
            <Stat label="Entries" value={String(state?.round.entries ?? 0)} />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Time left</div>
              <div className={`font-mono text-4xl tabular-nums sm:text-5xl ${urgent ? "text-red-400" : ""}`}>
                {mm}:{ss.toString().padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Easel */}
        <section className="min-w-0">
          <DrawingCanvas ref={canvas} disabled={!!submitted || closed} />

          <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:grid-cols-2">
            <Field label="Artist name" value={artist} onChange={setArtist} placeholder="Anonymous Picasso" max={32} required />
            <Field label="Title (optional)" value={title} onChange={setTitle} placeholder="Let the Curator name it" max={48} />
            <div className="sm:col-span-2">
              <Field
                label="Your Solana wallet (public address) — winnings are sent here automatically"
                value={wallet}
                onChange={(v) => setWallet(v.trim())}
                placeholder="e.g. 7xKX…"
                mono
                required
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={busy || !!submitted || closed || !state?.round.prompt}
                className="rounded-lg bg-[var(--gold)] px-6 py-3 font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitted ? "Submitted ✓" : closed ? "Time's up" : busy ? "Hanging…" : "Submit to the Curator"}
              </button>
              {msg && <span className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
            </div>
          </form>
        </section>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          {state && state.previous.status === "judging" && (
            <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-4 text-sm">
              <div className="font-semibold text-[var(--gold)]">Judging round #{state.previous.id}…</div>
              <div className="mt-1 text-[var(--muted)]">The Curator is studying {state.previous.entries} entr{state.previous.entries === 1 ? "y" : "ies"} and will hang a winner shortly.</div>
            </div>
          )}

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gold)]">Latest acquisition</div>
            {state?.latest ? (
              <FramedArt entry={state.latest} />
            ) : (
              <p className="text-sm text-[var(--muted)]">The walls are bare. Be the first artist hung in the museum.</p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 text-sm leading-relaxed text-[var(--muted)]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gold)]">How it works</div>
            <ol className="list-decimal space-y-2 pl-4">
              <li>Every 5 minutes an AI agent — the Curator — commissions a new piece.</li>
              <li>You have 5 minutes to draw it by hand on the canvas.</li>
              <li>Submit with your Solana wallet address. One entry per wallet per round.</li>
              <li>When time runs out the Curator picks its favorite, hangs it in the museum forever, and automatically pays the artist all project fees collected in the treasury.</li>
              <li>No entries? The pot rolls over to the next round.</li>
            </ol>
            {state?.pot.treasury && (
              <p className="mt-4 break-all text-xs">
                Treasury:{" "}
                <a className="font-mono underline decoration-dotted hover:text-[var(--gold)]" href={`https://solscan.io/account/${state.pot.treasury}`} target="_blank" rel="noreferrer">
                  {shortAddr(state.pot.treasury)}
                </a>
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">{label}</div>
      <div className="font-mono text-xl tabular-nums text-[var(--gold)]">{value}</div>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; max?: number; mono?: boolean; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-[var(--muted)]">
      {props.label}
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        maxLength={props.max}
        required={props.required}
        className={`rounded-lg border border-[var(--line)] bg-black/30 px-3 py-2.5 text-sm text-[var(--fg)] outline-none placeholder:text-white/25 focus:border-[var(--gold)] ${props.mono ? "font-mono" : ""}`}
      />
    </label>
  );
}
