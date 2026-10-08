"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { shortAddr, useShell } from "@/components/AppShell";
import { GalleryCritic } from "@/components/Critic";
import type { Submission } from "@/lib/rounds";

type RoundInfo = { id: number; prompt: string | null; status: "open" | "judging" | "done" | "empty"; winnerId: string | null; winnerTitle: string | null };
type Data = { round: RoundInfo | null; entries?: Submission[]; remarks?: Record<string, string>; rounds: { id: number; prompt: string | null; entries: number }[]; current: number };

const STATUS: Record<RoundInfo["status"], string> = {
  open: "Open · drawing now",
  judging: "Curator is judging…",
  done: "Winner hung",
  empty: "Closed",
};

const CRITIC_TOUR = 12;

const timeAgo = (t: number) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function Submissions() {
  const { pubkey } = useShell();
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [zoom, setZoom] = useState<Submission | null>(null);
  const [mine, setMine] = useState("");

  useEffect(() => {
    try {
      setMine(localStorage.getItem("wallet") ?? "");
    } catch {}
  }, []);

  const statusRef = useRef<string | undefined>(undefined);
  statusRef.current = data?.round?.status;

  const load = useCallback(async () => {
    const res = await fetch(`/api/submissions${selected !== null ? `?round=${selected}` : ""}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [selected]);

  useEffect(() => {
    load();
    // Keep live rounds fresh; finished rounds don't change once the winner is hung.
    const t = setInterval(() => {
      const status = statusRef.current;
      if (!status || status === "open" || status === "judging") load();
    }, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const round = data?.round;
  const entries = data?.entries ?? [];
  const sorted = [...entries].sort((a, b) => Number(b.id === round?.winnerId) - Number(a.id === round?.winnerId));
  const isMine = (w: string) => w === pubkey || w === mine;

  return (
    <main className="wrap">
      <header className="pagehead">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Every entry, every round</div>
          <h2>
            The <em>submissions.</em>
          </h2>
          <p className="sub">See what everyone drew for each commission. The Curator&apos;s pick is framed in gold.</p>
        </div>
        <Link className="btn btn-solid" href="/#studio">
          Enter this round
        </Link>
      </header>

      {data && data.rounds.length > 0 && (
        <div className="roundbar" role="group" aria-label="Rounds">
          {data.rounds.map((r) => (
            <button key={r.id} type="button" aria-pressed={round?.id === r.id} onClick={() => setSelected(r.id)} title={r.prompt ?? undefined}>
              #{r.id}
              {r.id === data.current ? " · live" : ""} · {r.entries}
              <span>{r.prompt ?? "—"}</span>
            </button>
          ))}
        </div>
      )}

      {data && !round && (
        <div className="empty frame">
          <div className="mat">
            <div className="bare">
              <div>
                <b>No entries yet.</b>
                <span>
                  Nobody has submitted a drawing so far. <Link href="/#studio" style={{ textDecoration: "underline" }}>Be the first.</Link>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {round && (
        <>
          <div className="roundhead">
            <div style={{ minWidth: 0 }}>
              <div className="label">Round #{round.id} commission</div>
              <div className="prompt">{round.prompt ? `“${round.prompt}”` : "—"}</div>
            </div>
            <span className={`status ${round.status}`}>
              {round.status === "open" && <span className="live-dot" />}
              {STATUS[round.status]} · {entries.length} entr{entries.length === 1 ? "y" : "ies"}
            </span>
          </div>

          <div className="gallery-stage" ref={stageRef}>
            {entries.length === 0 ? (
              <div className="gallery-empty">
                <b>No entries for this round.</b>
                <span>The critic is pacing.</span>
              </div>
            ) : (
              <div className="entries">
                {sorted.map((s, i) => (
                  <div
                    className={`card${s.id === round.winnerId ? " win" : ""}`}
                    key={s.id}
                    ref={(el) => {
                      cardRefs.current[i] = el;
                    }}
                  >
                    {s.id === round.winnerId && <span className="badge">Curator&apos;s pick</span>}
                    {isMine(s.wallet) && <span className="mine">You</span>}
                    <button className="open" type="button" onClick={() => setZoom(s)} aria-label={`View ${s.title || "Untitled"} by ${s.artist}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/sub-art/${s.id}`} alt={s.title || "Untitled"} loading="lazy" />
                    </button>
                    <div className="meta">
                      <span className="t">{s.id === round.winnerId && round.winnerTitle ? round.winnerTitle : s.title || "Untitled"}</span>
                      <span className="a">{s.artist}</span>
                      <span className="m">
                        {shortAddr(s.wallet)} · {timeAgo(s.createdAt)}
                      </span>
                      {data?.remarks?.[s.id] && <span className="remark">“{data.remarks[s.id]}” — the Critic</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* He patrols the first rows only so he stays near the top of long rounds. */}
            <GalleryCritic stageRef={stageRef} cardRefs={cardRefs} ids={sorted.slice(0, CRITIC_TOUR).map((s) => s.id)} remarks={data?.remarks ?? {}} />
          </div>
        </>
      )}

      {zoom && (
        <div className="lightbox" onClick={() => setZoom(null)} role="dialog" aria-modal="true">
          <figure onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/sub-art/${zoom.id}`} alt={zoom.title || "Untitled"} />
            <figcaption>
              <div>
                <div style={{ fontWeight: 700 }}>{zoom.title || "Untitled"}</div>
                <div className="m" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
                  {zoom.artist} · {shortAddr(zoom.wallet)}
                </div>
              </div>
              <button className="btn btn-glass" type="button" onClick={() => setZoom(null)} style={{ padding: "8px 14px" }}>
                Close
              </button>
            </figcaption>
          </figure>
        </div>
      )}
    </main>
  );
}
