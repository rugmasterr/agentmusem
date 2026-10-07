"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReveal, useShell } from "@/components/AppShell";
import DrawingCanvas, { CanvasHandle } from "@/components/DrawingCanvas";
import { ArtFrame, Placard, shortAddr } from "@/components/Placard";
import type { MuseumEntry } from "@/lib/rounds";

type State = {
  now: number;
  roundMs: number;
  round: { id: number; start: number; end: number; prompt: string | null; entries: number };
  previous: { id: number; entries: number; status: "judging" | "empty" | "done" };
  latest: MuseumEntry | null;
  pastPrompts: string[];
  pot: { sol: number; treasury: string | null };
};

const GRACE_MS = 5000;
const isSol = (a: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);

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

/** Types the commission out like the original design, re-running whenever the text changes. */
function useTyped(text: string | null) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!text) return setOut("");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setOut(text);
    let i = 0;
    setOut("");
    const t = setInterval(() => {
      setOut(text.slice(0, ++i));
      if (i >= text.length) clearInterval(t);
    }, 38);
    return () => clearInterval(t);
  }, [text]);
  return out;
}

export default function Studio() {
  const { pubkey, connect, toast } = useShell();
  const [state, setState] = useState<State | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(0);
  const [artist, setArtist] = useState("");
  const [addr, setAddr] = useState("");
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<{ round: number; img: string; title: string; artist: string } | null>(null);
  const canvas = useRef<CanvasHandle>(null);
  const roundRef = useRef<number | null>(null);
  useReveal();

  useEffect(() => {
    setArtist(load("artist"));
    setAddr(load("wallet"));
  }, []);

  useEffect(() => {
    if (pubkey) setAddr((a) => a || pubkey);
  }, [pubkey]);

  const poll = useCallback(async () => {
    try {
      const t0 = Date.now();
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return;
      const s: State = await res.json();
      setOffset(s.now - (t0 + Date.now()) / 2);
      setState(s);
      if (roundRef.current !== null && roundRef.current !== s.round.id) {
        canvas.current?.reset();
        setTitle("");
        setErr("");
        toast("New commission from the Curator!");
      }
      roundRef.current = s.round.id;
    } catch {}
  }, [toast]);

  useEffect(() => {
    poll();
    const p = setInterval(poll, 3000);
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(p);
      clearInterval(t);
    };
  }, [poll]);

  const typed = useTyped(state?.round.prompt ?? null);
  const serverNow = now + offset;
  const left = state ? Math.max(0, state.round.end - serverNow) : 0;
  const secs = Math.ceil(left / 1000);
  const closed = state ? serverNow > state.round.end + GRACE_MS : false;
  const hasSubmitted = !!state && submitted?.round === state.round.id;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!state || !canvas.current) return;
    const name = artist.trim();
    const wallet = addr.trim();
    if (hasSubmitted) return setErr("You already entered this round. Wait for the next commission.");
    if (closed) return setErr("Time's up for this round. A new commission is coming.");
    if (canvas.current.isBlank()) return setErr("The canvas is empty. Draw the commission first.");
    if (!name) return setErr("Add your artist name.");
    if (!isSol(wallet)) return setErr("That doesn’t look like a Solana address. Paste your public address or use Phantom.");
    setBusy(true);
    save("artist", name);
    save("wallet", wallet);
    const img = canvas.current.toJpeg();
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ round: state.round.id, artist: name, title, wallet, image: img }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setSubmitted({ round: state.round.id, img, title: title.trim() || "Untitled", artist: name });
      toast("Entry received. Good luck!");
      poll();
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ticker = state?.pastPrompts.length ? state.pastPrompts : null;
  const latest = state?.latest;

  return (
    <>
      {ticker && (
        <div className="ticker" aria-hidden="true">
          <div className="run">
            {[...ticker, ...ticker].map((p, i) => (
              <span key={i}>Past commission: {p}</span>
            ))}
          </div>
        </div>
      )}

      <main className="wrap" id="top">
        <header className="hero">
          <div style={{ minWidth: 0 }}>
            <div className="kicker glass">
              <span className="live-dot" />
              Round <b>#{state?.round.id ?? "—"}</b> is open
            </div>
            <h1>
              <span className="l">
                <span>Draw for the</span>
              </span>
              <span className="l">
                <span>
                  <em>AI Curator.</em>
                </span>
              </span>
            </h1>
            <p className="lede">
              Every 5 minutes an AI agent commissions a new artwork. You have 5 minutes to draw it by hand. The Curator hangs its favourite in the
              museum and pays the artist in SOL.
            </p>
            <div className="ctas">
              <a className="btn btn-solid" href="#studio">
                Start drawing
              </a>
              <Link className="btn btn-glass" href="/submissions">
                See all entries
              </Link>
            </div>
          </div>

          <aside className="glass brief" aria-label="Current commission">
            <div className="brief-top">
              <div className="curator">
                <svg viewBox="0 0 24 24">
                  <circle cx="9" cy="10" r="1.2" />
                  <circle cx="15" cy="10" r="1.2" />
                  <path d="M8.5 15c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5" />
                </svg>
              </div>
              <div>
                <div className="who">The Curator requests</div>
                <div className="round">Round #{state?.round.id ?? "—"}</div>
              </div>
            </div>
            <div className="label">This round&apos;s commission</div>
            <div className="prompt" aria-live="polite">
              <span>{state?.round.prompt ? typed : "The Curator is thinking…"}</span>
              <span className="caret" />
            </div>
            <div className="stats">
              <div className="stat">
                <div className="label">Pot</div>
                <div className="v">
                  {(state?.pot.sol ?? 0).toFixed(3)}
                  <small>SOL</small>
                </div>
              </div>
              <div className="stat">
                <div className="label">Entries</div>
                <div className="v">{state?.round.entries ?? 0}</div>
              </div>
              <div className="stat">
                <div className="label">Time left</div>
                <div className="v" style={{ color: state && secs <= 30 ? "var(--rose)" : undefined }}>
                  {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
                </div>
              </div>
            </div>
            <div className="timebar">
              <i style={{ transform: `scaleX(${state ? left / state.roundMs : 1})` }} />
            </div>
            <div className="demo">
              {state?.previous.status === "judging" ? (
                <>
                  Judging round #{state.previous.id} · {state.previous.entries} entr{state.previous.entries === 1 ? "y" : "ies"}…
                </>
              ) : state?.pot.treasury ? (
                <>
                  Treasury{" "}
                  <a href={`https://solscan.io/account/${state.pot.treasury}`} target="_blank" rel="noreferrer">
                    {shortAddr(state.pot.treasury)}
                  </a>{" "}
                  · live on Solana
                </>
              ) : (
                "Live round"
              )}
            </div>
          </aside>
        </header>

        <section id="studio" style={{ paddingTop: 40 }}>
          <div className="studio">
            <div className="glass easel rv">
              <DrawingCanvas ref={canvas} disabled={hasSubmitted || closed} />
            </div>

            <form className="glass entry rv" noValidate onSubmit={onSubmit}>
              <h3>Submit your piece</h3>
              <p className="small">One entry per wallet per round. Winnings go straight to your wallet.</p>
              <div className="form">
                <div>
                  <label htmlFor="artist">Artist name</label>
                  <input type="text" id="artist" placeholder="e.g. lowpoly.lou" maxLength={32} value={artist} onChange={(e) => setArtist(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="title">
                    Title <i>(optional)</i>
                  </label>
                  <input type="text" id="title" placeholder="Untitled" maxLength={48} value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="addr">Solana wallet</label>
                  <div className="walletrow">
                    <input
                      type="text"
                      id="addr"
                      className="mono"
                      placeholder="Public address"
                      autoComplete="off"
                      spellCheck={false}
                      value={addr}
                      onChange={(e) => setAddr(e.target.value.trim())}
                    />
                    <button
                      type="button"
                      className="btn btn-glass use-ph"
                      onClick={async () => {
                        const k = pubkey ?? (await connect());
                        if (k) setAddr(k);
                      }}
                    >
                      Use Phantom
                    </button>
                  </div>
                </div>
                <div className="err" role="alert">
                  {err}
                </div>
                <button className="btn btn-solid" type="submit" disabled={busy || hasSubmitted || closed || !state?.round.prompt}>
                  {hasSubmitted ? "Entered ✓" : closed ? "Time's up" : busy ? "Submitting…" : "Submit to the Curator"}
                </button>
                {hasSubmitted && submitted && (
                  <div className="submitted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" src={submitted.img} />
                    <div>
                      <b>{submitted.title}</b>
                      <span>
                        Entered as {submitted.artist}. Waiting for the Curator. <Link href="/submissions" style={{ textDecoration: "underline" }}>See all entries</Link>
                      </span>
                    </div>
                  </div>
                )}
                <p className="fine">Public address only. Never paste a seed phrase or private key anywhere on this site.</p>
              </div>
            </form>
          </div>
        </section>

        <section id="museum">
          <div className="acq">
            <div className="rv" style={{ position: "relative" }}>
              {latest ? (
                <ArtFrame src={`/api/art/${latest.round}`} alt={latest.title} />
              ) : (
                <div className="frame">
                  <div className="mat">
                    <div className="bare">
                      <div>
                        <b>The walls are bare.</b>
                        <span>Be the first artist hung in the museum.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="rv" style={{ minWidth: 0 }}>
              <div className="eyebrow">Latest acquisition</div>
              <h2>
                Hung permanently. <em>Paid instantly.</em>
              </h2>
              <p className="sub">Every winning piece joins the permanent collection with the artist&apos;s name, title, round and payout on its placard.</p>
              {latest ? (
                <Placard entry={latest} />
              ) : (
                <div className="placard glass">
                  <span className="t">Awaiting first work</span>
                  <span className="m">Round — · — SOL paid</span>
                </div>
              )}
              <div style={{ marginTop: 20 }}>
                <Link className="btn btn-glass" href="/museum">
                  Visit the museum
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="how">
          <div className="rv">
            <div className="eyebrow">How it works</div>
            <h2>
              Five minutes. <em>One winner.</em>
            </h2>
          </div>
          <div className="steps">
            {[
              ["The commission", "Every 5 minutes the Curator, an AI agent, requests a new piece."],
              ["You draw", "You have 5 minutes to draw it by hand on the canvas."],
              ["You submit", "Enter your Solana wallet. One entry per wallet per round."],
              ["The Curator picks", "Its favourite is hung for good, and the artist gets every fee in the treasury."],
              ["Or it rolls over", "No entries? The pot carries into the next round."],
            ].map(([h, p], i) => (
              <div className="glass step rv" key={h}>
                <div className="n">{i + 1}</div>
                <h4>{h}</h4>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
