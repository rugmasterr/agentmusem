"use client";

import { Ref, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export const W = 800;
export const H = 600;

export type CanvasHandle = {
  toJpeg: () => string;
  isBlank: () => boolean;
  reset: () => void;
};

type Tool = "brush" | "eraser" | "fill";

const PALETTE = [
  "#111111", "#ffffff", "#7f7f7f", "#c3c3c3", "#e3242b", "#ff7f27", "#ffd400", "#22b14c",
  "#00a2e8", "#3f48cc", "#a349a4", "#ff8fc7", "#8b5a2b", "#f5d0a9", "#0b6e4f", "#1b263b",
];

function hexToRgba(hex: string): [number, number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, hex: string) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const start = (y * W + x) * 4;
  const target = [d[start], d[start + 1], d[start + 2], d[start + 3]];
  const fill = hexToRgba(hex);
  if (target.every((v, i) => Math.abs(v - fill[i]) < 4)) return;
  const tol = 48;
  const match = (i: number) =>
    Math.abs(d[i] - target[0]) <= tol &&
    Math.abs(d[i + 1] - target[1]) <= tol &&
    Math.abs(d[i + 2] - target[2]) <= tol &&
    Math.abs(d[i + 3] - target[3]) <= tol;
  const seen = new Uint8Array(W * H);
  const stack = [x, y];
  while (stack.length) {
    const cy = stack.pop()!;
    let cx = stack.pop()!;
    while (cx >= 0 && !seen[cy * W + cx] && match((cy * W + cx) * 4)) cx--;
    cx++;
    let up = false;
    let down = false;
    while (cx < W && !seen[cy * W + cx] && match((cy * W + cx) * 4)) {
      const p = cy * W + cx;
      seen[p] = 1;
      d.set(fill, p * 4);
      if (cy > 0) {
        const m = !seen[p - W] && match((p - W) * 4);
        if (m && !up) stack.push(cx, cy - 1);
        up = m;
      }
      if (cy < H - 1) {
        const m = !seen[p + W] && match((p + W) * 4);
        if (m && !down) stack.push(cx, cy + 1);
        down = m;
      }
      cx++;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export default function DrawingCanvas({ ref, disabled }: { ref?: Ref<CanvasHandle>; disabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const history = useRef<ImageData[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  const drawn = useRef(false);
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(8);
  const [undoCount, setUndoCount] = useState(0);

  const ctx = () => canvasRef.current!.getContext("2d", { willReadFrequently: true })!;

  const wipe = useCallback(() => {
    const c = ctx();
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, W, H);
  }, []);

  useEffect(() => wipe(), [wipe]);

  const snapshot = () => {
    history.current.push(ctx().getImageData(0, 0, W, H));
    if (history.current.length > 40) history.current.shift();
    setUndoCount(history.current.length);
  };

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (prev) ctx().putImageData(prev, 0, 0);
    setUndoCount(history.current.length);
  }, []);

  useImperativeHandle(ref, () => ({
    toJpeg: () => canvasRef.current!.toDataURL("image/jpeg", 0.85),
    isBlank: () => !drawn.current,
    reset: () => {
      wipe();
      history.current = [];
      drawn.current = false;
      setUndoCount(0);
    },
  }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const point = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * W),
      y: Math.round(((e.clientY - rect.top) / rect.height) * H),
    };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const c = ctx();
    c.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    c.lineWidth = size;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(to.x, to.y);
    c.stroke();
  };

  const onDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    snapshot();
    drawn.current = true;
    if (tool === "fill") {
      floodFill(ctx(), Math.min(W - 1, Math.max(0, p.x)), Math.min(H - 1, Math.max(0, p.y)), color);
      return;
    }
    last.current = p;
    stroke(p, p);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!last.current || disabled) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events) {
      const p = point(ev as unknown as React.PointerEvent);
      stroke(last.current, p);
      last.current = p;
    }
  };

  const onUp = () => {
    last.current = null;
  };

  const toolBtn = (t: Tool, label: string) => (
    <button
      type="button"
      onClick={() => setTool(t)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        tool === t ? "bg-[var(--gold)] text-black" : "bg-white/5 text-[var(--fg)] hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-sm border-[10px] border-[#2a2018] bg-[#2a2018] shadow-[0_0_0_2px_var(--gold),0_20px_60px_rgba(0,0,0,0.6)]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className={`block aspect-[4/3] w-full touch-none bg-white ${disabled ? "cursor-not-allowed opacity-70" : "cursor-crosshair"}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {toolBtn("brush", "Brush")}
        {toolBtn("eraser", "Eraser")}
        {toolBtn("fill", "Fill")}
        <span className="mx-1 h-6 w-px bg-white/10" />
        <button type="button" onClick={undo} disabled={!undoCount} className="rounded-md bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-40">
          Undo
        </button>
        <button
          type="button"
          onClick={() => {
            snapshot();
            wipe();
          }}
          className="rounded-md bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
        >
          Clear
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-[var(--muted)]">
          Size
          <input type="range" min={2} max={60} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-28 accent-[var(--gold)]" />
          <span className="w-6 tabular-nums">{size}</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => {
              setColor(c);
              if (tool === "eraser") setTool("brush");
            }}
            className={`h-7 w-7 rounded-full border transition ${color === c ? "scale-110 border-[var(--gold)] ring-2 ring-[var(--gold)]" : "border-white/20"}`}
            style={{ background: c }}
          />
        ))}
        <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-white/20 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Custom color">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  );
}
