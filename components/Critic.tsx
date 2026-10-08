"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export const CRITIC_W = 96;
export const CRITIC_H = 150;
const SPEED = 110; // px per second

const QUIPS = [
  "Five minutes, darling. Art waits for no one.",
  "I've seen finer brushwork on a napkin. Prove me wrong.",
  "The Curator is watching. As am I.",
  "Bold strokes! Or none at all.",
  "Ah, the aroma of fresh pixels.",
  "Is that a masterpiece forming? Hm. We shall see.",
  "In my day we drew with a mouse AND a soul.",
  "The pot goes to genius. Or whoever bothers to try.",
  "Do not touch the art. Unless it is yours.",
  "*twirls mustache thoughtfully*",
];

const THINKING = [
  "Hmm… hmmm.",
  "*adjusts monocle*",
  "Fascinating. Truly. Possibly.",
  "The composition… speaks. Mumbles, really.",
  "Let me get closer…",
  "Ooh. Ooh? No. Hmm.",
  "I must consult my mustache.",
  "What is the artist trying to say?",
];

/** The critic himself. Faces right by default; `walking` swings the legs, `talking` wiggles the mustache. */
export function CriticFigure({ walking, talking, facing = "right" }: { walking?: boolean; talking?: boolean; facing?: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 100 160"
      width={CRITIC_W}
      height={CRITIC_H}
      className={`critic-svg${walking ? " walking" : ""}${talking ? " talking" : ""}`}
      style={{ transform: facing === "left" ? "scaleX(-1)" : undefined }}
      aria-hidden="true"
    >
      <ellipse cx="50" cy="155" rx="26" ry="4" fill="rgba(14,14,16,.16)" />
      {/* legs */}
      <g className="leg leg-b">
        <rect x="41" y="116" width="9" height="34" rx="2" fill="#26262c" />
        <ellipse cx="47" cy="151" rx="8" ry="3.6" fill="#0e0e10" />
      </g>
      <g className="leg leg-f">
        <rect x="52" y="116" width="9" height="34" rx="2" fill="#33333a" />
        <ellipse cx="58" cy="151" rx="8" ry="3.6" fill="#0e0e10" />
      </g>
      {/* back arm */}
      <path d="M34 80 Q26 98 31 112" stroke="#6e5238" strokeWidth="8" strokeLinecap="round" fill="none" />
      <circle cx="31" cy="113" r="4" fill="#efc6a2" />
      {/* jacket */}
      <path d="M30 76 Q50 68 70 76 L74 122 Q50 128 26 122 Z" fill="#7a5c3e" />
      <path d="M30 76 Q50 68 70 76 L74 122 Q50 128 26 122 Z" fill="url(#tweed)" opacity=".35" />
      <path d="M43 72 L50 92 L57 72 Z" fill="#fbfaf6" />
      <path d="M42 73 L50 96 L38 84 Z M58 73 L50 96 L62 84 Z" fill="#5f4630" />
      <circle cx="50" cy="104" r="1.6" fill="#2a1f14" />
      <circle cx="50" cy="113" r="1.6" fill="#2a1f14" />
      {/* bow tie */}
      <path d="M44 72 L50 75 L44 78 Z M56 72 L50 75 L56 78 Z" fill="#1f2bff" />
      <circle cx="50" cy="75" r="1.8" fill="#1f2bff" />
      {/* front arm + magnifying glass */}
      <g className="arm-f">
        <path d="M66 80 Q78 80 82 70" stroke="#7a5c3e" strokeWidth="8" strokeLinecap="round" fill="none" />
        <circle cx="83" cy="68" r="4" fill="#efc6a2" />
        <line x1="84" y1="66" x2="88" y2="58" stroke="#3b2a1a" strokeWidth="3" strokeLinecap="round" />
        <circle cx="92" cy="50" r="8.5" fill="rgba(170,210,255,.45)" stroke="#0e0e10" strokeWidth="2.6" />
        <path d="M88 47 q2 -3 5 -3" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </g>
      {/* head */}
      <rect x="45" y="60" width="10" height="10" fill="#e8b994" />
      <circle cx="34" cy="49" r="3.5" fill="#e8b994" />
      <circle cx="50" cy="48" r="17" fill="#efc6a2" />
      {/* beret */}
      <path d="M31 40 Q34 26 52 26 Q70 27 70 38 Q60 34 50 36 Q40 37 31 40 Z" fill="#0e0e10" />
      <rect x="49" y="22" width="3" height="5" rx="1.5" fill="#0e0e10" />
      {/* brows + eyes */}
      <path d="M40 41 Q44 37 48 40" stroke="#0e0e10" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M53 39 Q58 35 63 39" stroke="#0e0e10" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="44.5" cy="45.5" r="1.7" fill="#0e0e10" className="eye" />
      <circle cx="58" cy="45.5" r="1.7" fill="#0e0e10" className="eye" />
      {/* monocle */}
      <circle cx="58" cy="45.5" r="5" fill="rgba(255,255,255,.25)" stroke="#c9a227" strokeWidth="1.5" />
      <path d="M63 47 Q66 58 61 66" stroke="#c9a227" strokeWidth=".8" fill="none" />
      {/* nose */}
      <ellipse cx="53" cy="51.5" rx="4" ry="3.4" fill="#e3a07f" />
      {/* handlebar mustache */}
      <g className="stache">
        <path d="M52 55 C47 53 41 54 38 58 C36 60 34 59 34 56 C33 60 37 63 41 61 C45 60 49 59 52 58 Z" fill="#0e0e10" />
        <path d="M52 55 C57 53 63 54 66 58 C68 60 70 59 70 56 C71 60 67 63 63 61 C59 60 55 59 52 58 Z" fill="#0e0e10" />
      </g>
      <defs>
        <pattern id="tweed" width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M0 4 L4 0" stroke="#2a1f14" strokeWidth=".6" />
        </pattern>
      </defs>
    </svg>
  );
}

function Bubble({ text, align }: { text: string; align: "left" | "center" | "right" }) {
  return (
    <div className={`bubble bubble-${align}`} role="status" aria-live="polite">
      {text}
    </div>
  );
}

const reduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Strolls along the bottom of the viewport between rounds, dropping the occasional quip. Click him for more. */
export function WanderingCritic() {
  const [x, setX] = useState(-200);
  const [dur, setDur] = useState(0);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<"left" | "right">("right");
  const [line, setLine] = useState<string | null>(null);
  const quipIdx = useRef(0);
  const xRef = useRef(-200);

  const say = (text: string, ms = 4200) => {
    setLine(text);
    setTimeout(() => setLine((l) => (l === text ? null : l)), ms);
  };
  const quip = () => say(QUIPS[quipIdx.current++ % QUIPS.length]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (!alive) return;
      const max = Math.max(innerWidth - CRITIC_W - 16, 16);
      const target = reduced() ? max : 16 + Math.random() * (max - 16);
      const d = Math.abs(target - xRef.current);
      const ms = reduced() ? 0 : Math.max(600, (d / SPEED) * 1000);
      setFacing(target < xRef.current ? "left" : "right");
      setDur(ms);
      setX(target);
      xRef.current = target;
      setWalking(ms > 0);
      timer = setTimeout(() => {
        setWalking(false);
        if (Math.random() < 0.45) quip();
        timer = setTimeout(step, 3500 + Math.random() * 5000);
      }, ms);
    };
    timer = setTimeout(step, 1500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const align = x < 140 ? "left" : x > (typeof window === "undefined" ? 0 : innerWidth) - 240 ? "right" : "center";

  return (
    <div className="critic critic-fixed" style={{ transform: `translateX(${x}px)`, transitionDuration: `${dur}ms` }}>
      {line && <Bubble text={line} align={align} />}
      <button type="button" className="critic-hit" onClick={quip} aria-label="The critic">
        <CriticFigure walking={walking} talking={!!line} facing={facing} />
      </button>
    </div>
  );
}

/**
 * Walks the critic to card `target` inside `stageRef` (cards from `cardRefs`). With no card (target < 0) he waits
 * at the stage's bottom-left. `arrived` flips true once he's there, which is when he should speak.
 */
function useCriticWalk(
  stageRef: React.RefObject<HTMLElement | null>,
  cardRefs: React.RefObject<(HTMLElement | null)[]>,
  target: number,
  layoutKey: unknown,
) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dur, setDur] = useState(0);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<"left" | "right">("right");
  const [arrived, setArrived] = useState(false);
  const posRef = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const move = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const card = target >= 0 ? cardRefs.current[target] : null;
      const x = card
        ? Math.min(Math.max(card.offsetLeft + card.offsetWidth * 0.5 - CRITIC_W * 0.85, 0), stage.clientWidth - CRITIC_W)
        : 16;
      const y = card ? card.offsetTop + card.offsetHeight - CRITIC_H + 18 : stage.clientHeight - CRITIC_H - 6;
      const prev = posRef.current;
      const d = prev ? Math.hypot(x - prev.x, y - prev.y) : 0;
      const ms = prev && !reduced() ? Math.min(Math.max((d / SPEED) * 1000, d < 4 ? 0 : 500), 2600) : 0;
      if (prev && Math.abs(x - prev.x) > 4) setFacing(x < prev.x ? "left" : "right");
      posRef.current = { x, y };
      setDur(ms);
      setPos({ x, y });
      setWalking(ms > 0);
      setArrived(ms === 0);
      return ms;
    };
    const ms = move() ?? 0;
    const t = setTimeout(() => {
      setWalking(false);
      setArrived(true);
    }, ms);
    // Re-place him instantly when the stage reflows (ResizeObserver also fires once on attach — ignore that).
    let width = stageRef.current?.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = stageRef.current?.clientWidth;
      if (w === width) return;
      width = w;
      posRef.current = null;
      move();
    });
    if (stageRef.current) ro.observe(stageRef.current);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, layoutKey]);

  return { pos, dur, walking, facing, arrived };
}

/** The critic positioned inside a stage, with his speech bubble kept on-screen. */
function StagedCritic({ walk, line, stageW }: { walk: ReturnType<typeof useCriticWalk>; line: string | null; stageW: number }) {
  const align = walk.pos.x < 120 ? "left" : walk.pos.x > stageW - 220 ? "right" : "center";
  return (
    <div className="critic critic-stage" style={{ transform: `translate(${walk.pos.x}px, ${walk.pos.y}px)`, transitionDuration: `${walk.dur}ms` }}>
      {line && <Bubble text={line} align={align} />}
      <CriticFigure walking={walk.walking} talking={!!line} facing={walk.facing} />
    </div>
  );
}

const FRESH = ["Ooh, a fresh one! Let me see…", "Still wet! Stand back…", "A new arrival. *adjusts monocle*"];
const WAITING = [
  "No entries yet. I await genius.",
  "The walls are bare. As is my patience.",
  "Someone, anyone, draw something!",
  "I've been standing here for minutes. My mustache wilts.",
];

/**
 * The critic patrolling a grid of entries: he heads straight to any piece he hasn't seen yet, then keeps
 * circling the rest, delivering each piece's remark (or musing while one is being written).
 */
export function GalleryCritic({
  stageRef,
  cardRefs,
  ids,
  remarks,
}: {
  stageRef: React.RefObject<HTMLElement | null>;
  cardRefs: React.RefObject<(HTMLElement | null)[]>;
  ids: string[];
  remarks: Record<string, string>;
}) {
  const seen = useRef(new Set<string>());
  const [current, setCurrent] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const target = current ? ids.indexOf(current) : -1;
  const walk = useCriticWalk(stageRef, cardRefs, target, ids.join(","));

  // Pick the next piece: unseen first (newest are first in `ids`), otherwise the next one round the circuit.
  useEffect(() => {
    if (!ids.length) return setCurrent(null);
    if (current && ids.includes(current) && tick === 0) return;
    const unseen = ids.find((id) => !seen.current.has(id));
    const next = unseen ?? ids[(ids.indexOf(current ?? "") + 1) % ids.length];
    seen.current.add(next);
    setCurrent(next);
    setTick(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(","), tick]);

  const fresh = current !== null && !remarks[current];
  const line = !walk.arrived
    ? null
    : !ids.length
      ? WAITING[Math.floor(Date.now() / 9000) % WAITING.length]
      : current
        ? remarks[current] || FRESH[ids.indexOf(current) % FRESH.length]
        : null;

  // Linger to read, then move on. Lingers longer on a piece whose remark is still being written.
  useEffect(() => {
    if (!walk.arrived || !ids.length) return;
    const read = fresh ? 7000 : Math.min(2600 + (line?.length ?? 0) * 45, 7000);
    const t = setTimeout(() => setTick((n) => n + 1), read);
    return () => clearTimeout(t);
  }, [walk.arrived, line, fresh, ids.length]);

  // While waiting on an empty room, rotate his complaints.
  const [, force] = useState(0);
  useEffect(() => {
    if (ids.length) return;
    const t = setInterval(() => force((n) => n + 1), 9000);
    return () => clearInterval(t);
  }, [ids.length]);

  return <StagedCritic walk={walk} line={line} stageW={stageRef.current?.clientWidth ?? 0} />;
}

export type Review = {
  round: number;
  total: number;
  entries: { id: string; artist: string; title: string }[];
  remarks: Record<string, string>;
  winnerId: string | null;
  winnerTitle: string | null;
  critique: string | null;
};

/**
 * The live review: the critic walks from piece to piece in step with the AI's judging.
 * While the AI deliberates he muses; once its verdict lands he delivers its per-piece remarks and ends at the winner.
 */
export function ReviewStage({ review }: { review: Review }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const [stop, setStop] = useState(0);

  const ready = Object.keys(review.remarks).length > 0 || !!review.winnerId;
  const winnerIdx = review.entries.findIndex((e) => e.id === review.winnerId);

  // The tour: musing loops over every piece; the verdict tour visits remarked pieces then ends on the winner.
  const tour = useMemo(() => {
    const all = review.entries.map((_, i) => i);
    if (!ready) return all;
    const remarked = all.filter((i) => i !== winnerIdx && review.remarks[review.entries[i].id]).slice(0, 8);
    return winnerIdx >= 0 ? [...remarked, winnerIdx] : remarked.length ? remarked : all;
  }, [ready, review.entries, review.remarks, winnerIdx]);

  useEffect(() => setStop(0), [ready, winnerIdx]);

  const target = tour[Math.min(stop, tour.length - 1)] ?? 0;
  const walk = useCriticWalk(stageRef, cardRefs, target, review.entries.length);
  const arrived = walk.arrived;
  const atWinner = ready && target === winnerIdx && stop >= tour.length - 1;
  const entry = review.entries[target];
  const line = !arrived
    ? null
    : !ready
      ? THINKING[stop % THINKING.length]
      : atWinner
        ? review.critique || "Magnificent. Hang it in the museum!"
        : (entry && review.remarks[entry.id]) || THINKING[stop % THINKING.length];

  // Linger long enough to read the line, then move on (musing loops forever; the verdict tour stops at the winner).
  useEffect(() => {
    if (!arrived || atWinner) return;
    const read = Math.min(2200 + (line?.length ?? 0) * 45, 6500);
    const t = setTimeout(() => setStop((s) => (ready ? Math.min(s + 1, tour.length - 1) : (s + 1) % Math.max(tour.length * 3, 1))), read);
    return () => clearTimeout(t);
  }, [arrived, atWinner, line, ready, tour.length]);


  return (
    <section className="review" aria-label={`The critic reviews round ${review.round}`}>
      <div className="review-head">
        <div>
          <div className="eyebrow">
            <span className="live-dot" /> Live review
          </div>
          <h3>
            The critic inspects round #{review.round}
            <span>
              {atWinner ? " · verdict is in" : ready ? " · delivering the verdict" : " · the Curator is deliberating…"}
            </span>
          </h3>
        </div>
        <span className="counter">
          <b>{review.total}</b> entr{review.total === 1 ? "y" : "ies"}
          {review.total > review.entries.length ? ` · showing ${review.entries.length}` : ""}
        </span>
      </div>
      <div className="review-stage" ref={stageRef}>
        {review.entries.map((e, i) => (
          <figure
            key={e.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className={`review-card${i === target ? " inspecting" : ""}${atWinner && i === winnerIdx ? " won" : ""}`}
          >
            {atWinner && i === winnerIdx && <span className="badge">Curator&apos;s pick</span>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/sub-art/${e.id}`} alt={e.title || "Untitled"} loading="lazy" />
            <figcaption>
              <b>{(atWinner && i === winnerIdx && review.winnerTitle) || e.title || "Untitled"}</b>
              <span>{e.artist}</span>
            </figcaption>
          </figure>
        ))}
        <StagedCritic walk={walk} line={line} stageW={stageRef.current?.clientWidth ?? 0} />
      </div>
    </section>
  );
}
