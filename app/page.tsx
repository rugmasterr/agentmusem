"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReveal, useShell } from "@/components/AppShell";
import { GalleryCritic, Review, ReviewStage } from "@/components/Critic";
import DrawingCanvas, { CanvasHandle } from "@/components/DrawingCanvas";
import { ArtFrame, Placard, shortAddr } from "@/components/Placard";
import type { MuseumEntry, Submission } from "@/lib/rounds";

type LiveEntries = {
  round: { id: number; status: string; winnerId: string | null } | null;
  entries?: Submission[];
  remarks?: Record<string, string>;
  total?: number;
  current: number;
};
const LIVE_LIMIT = 8;

type State = {
  now: number;
  roundMs: number;
  round: { id: number; start: number; end: number; prompt: string | null; entries: number };
  previous: { id: number; entries: number; status: "judging" | "empty" | "done" };
  latest: MuseumEntry | null;
  review: Review | null;
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
  const { pubkey, connect, toast, setCriticBusy } = useShell();
  const [state, setState] = useState<State | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(0);
  const [artist, setArtist] = useState("");
  const [addr, setAddr] = useState("");
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<{ round: number; img: string; title: string; artist: string } | null>(null);
  const [live, setLive] = useState<LiveEntries | null>(null);
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

  const currentRound = state?.round.id;
  const pollLive = useCallback(async () => {
    if (currentRound === undefined) return;
    try {
      const res = await fetch(`/api/submissions?round=${currentRound}&limit=${LIVE_LIMIT}`, { cache: "no-store" });
      if (res.ok) setLive(await res.json());
    } catch {}
  }, [currentRound]);

  useEffect(() => {
    pollLive();
    const t = setInterval(pollLive, 6000);
    return () => clearInterval(t);
  }, [pollLive]);

  useEffect(() => {
    poll();
    const p = setInterval(poll, 3000);
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(p);
      clearInterval(t);
    };
  }, [poll]);

  // On the home page the critic lives in the live-entries gallery (or on the review stage), never wandering.
  const onStage = !!state?.review?.entries.length;
  useEffect(() => {
    setCriticBusy(true);
    return () => setCriticBusy(false);
  }, [setCriticBusy]);
  const galleryRef = useRef<HTMLDivElement>(null);
  const galleryCards = useRef<(HTMLElement | null)[]>([]);

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
      pollLive();
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
              {state?.round.prompt ? <mark>{typed}</mark> : <span>The Curator is thinking…</span>}
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

        {onStage && state?.review && <ReviewStage review={state.review} />}

        <section id="studio" style={{ paddingTop: 40 }}>
          <div className={`drawthis${state && secs <= 30 ? " urgent" : ""}`}>
            <div className="dt-label">
              <span>Draw this</span>
              <span>Round #{state?.round.id ?? "—"}</span>
            </div>
            <div className="dt-prompt" aria-live="polite">
              {state?.round.prompt ? `“${state.round.prompt}”` : "The Curator is thinking…"}
            </div>
            <div className="dt-time">
              <span>Time left</span>
              <b>
                {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
              </b>
            </div>
            <i className="dt-bar" style={{ transform: `scaleX(${state ? left / state.roundMs : 1})` }} />
          </div>
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

          {(() => {
            const current = live?.round && live.round.id === currentRound ? live : null;
            const entries = current?.entries ?? [];
            return (
              <div className="live-entries">
                <div className="le-head">
                  <div>
                    <div className="eyebrow">
                      <span className="live-dot" /> Live entries · round #{currentRound ?? "—"}
                    </div>
                    <h3>What everyone&apos;s drawing</h3>
                  </div>
                  <Link className="btn btn-glass" href="/submissions">
                    See all{current?.total ? ` ${current.total}` : ""} →
                  </Link>
                </div>
                <div className="gallery-stage" ref={galleryRef}>
                  {entries.length ? (
                    <div className="entries">
                      {entries.map((e, i) => (
                        <Link
                          href="/submissions"
                          className="card"
                          key={e.id}
                          ref={(el) => {
                            galleryCards.current[i] = el;
                          }}
                        >
                          {(e.wallet === addr || e.wallet === pubkey) && <span className="mine">You</span>}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/sub-art/${e.id}`} alt={e.title || "Untitled"} loading="lazy" />
                          <div className="meta">
                            <span className="t">{e.title || "Untitled"}</span>
                            <span className="a">{e.artist}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="gallery-empty">
                      <b>No entries yet this round.</b>
                      <span>Submit yours and the critic will be over in a flash.</span>
                    </div>
                  )}
                  {!onStage && (
                    <GalleryCritic stageRef={galleryRef} cardRefs={galleryCards} ids={entries.map((e) => e.id)} remarks={current?.remarks ?? {}} />
                  )}
                </div>
              </div>
            );
          })()}
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
              ["The Curator picks", "Its favourite is hung for good, and the artist is paid 100% of the treasury, automatically."],
              ["Or it rolls over", "No entries? The pot keeps growing into the next round."],
            ].map(([h, p], i) => (
              <div className="glass step rv" key={h}>
                <div className="n">{i + 1}</div>
                <h4>{h}</h4>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="fees">
          <div className="rv">
            <div className="eyebrow">Where the prize comes from</div>
            <h2>
              Coin fees in. <em>Artists paid out.</em>
            </h2>
            <p className="sub">
              Every trade of the coin generates fees. 70% of them flow automatically into the treasury wallet, and every 5 minutes the treasury pays out
              everything it holds to that round&apos;s winning artist.
            </p>
          </div>
          <div className="flow rv">
            <div className="flow-step">
              <div className="n">01</div>
              <div className="big">Trading fees</div>
              <p>Every buy and sell of the coin generates creator fees.</p>
            </div>
            <div className="flow-arrow" aria-hidden="true">
              <span>70%</span>
            </div>
            <div className="flow-step hot">
              <div className="n">02</div>
              <div className="big">Treasury wallet</div>
              <p>
                70% of all fees land here automatically. The split happens on-chain at the source.
                {state?.pot.treasury && (
                  <>
                    {" "}
                    <a href={`https://solscan.io/account/${state.pot.treasury}`} target="_blank" rel="noreferrer">
                      {shortAddr(state.pot.treasury)} ↗
                    </a>
                  </>
                )}
              </p>
              <div className="flow-pot">
                Pot right now <b>{(state?.pot.sol ?? 0).toFixed(3)} SOL</b>
              </div>
            </div>
            <div className="flow-arrow" aria-hidden="true">
              <span>100%</span>
            </div>
            <div className="flow-step">
              <div className="n">03</div>
              <div className="big">The winner</div>
              <p>Every 5 minutes the whole treasury is sent straight to the winning artist&apos;s wallet. No claiming, no waiting.</p>
            </div>
          </div>
          <div className="fee-notes rv">
            <div>
              <b>100% of the treasury, every round.</b> The site never takes a cut of the treasury. The only thing held back is a tiny reserve
              (~0.003 SOL) so the wallet can pay Solana network fees.
            </div>
            <div>
              <b>No winner, no payout.</b> If nobody enters, nothing is sent and the pot rolls into the next round, so it gets bigger.
            </div>
            <div>
              <b>Fully on-chain.</b> Every payout is a public Solana transaction, linked from the winner&apos;s placard in the museum.
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
