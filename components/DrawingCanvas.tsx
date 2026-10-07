"use client";

import { Ref, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export const W = 800;
export const H = 600;
const PAPER = "#fbfaf6";

export type CanvasHandle = {
  toJpeg: () => string;
  isBlank: () => boolean;
  reset: () => void;
};

type Tool = "brush" | "eraser" | "fill";

const COLORS = ["#141414", "#ffffff", "#e5484d", "#f76b15", "#ffc53d", "#46a758", "#12a594", "#0090ff", "#6e56cf", "#d6409f", "#8d6e63"];

function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, hex: string) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const n = parseInt(hex.slice(1), 16);
  const fill = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  const start = (y * W + x) * 4;
  const target = [d[start], d[start + 1], d[start + 2]];
  if (Math.abs(target[0] - fill[0]) + Math.abs(target[1] - fill[1]) + Math.abs(target[2] - fill[2]) < 6) return;
  const match = (i: number) => Math.abs(d[i] - target[0]) + Math.abs(d[i + 1] - target[1]) + Math.abs(d[i + 2] - target[2]) < 90;
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

const ICONS: Record<string, React.ReactNode> = {
  brush: (
    <svg viewBox="0 0 24 24">
      <path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L11 15.8 8.2 13Z" />
      <path d="M7 14.5c-2 0-3.5 1.6-3.5 3.5 0 1.4-.8 2.3-2 2.5 1 .9 2.5 1.5 4 1.5 2.5 0 4.5-2 4.5-4.5" />
    </svg>
  ),
  eraser: (
    <svg viewBox="0 0 24 24">
      <path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 19" />
      <path d="M22 21H7M5 11l9 9" />
    </svg>
  ),
  fill: (
    <svg viewBox="0 0 24 24">
      <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0Z" />
      <path d="M5 2l5 5M2 13h15M22 20a2 2 0 1 1-4 0c0-1.6 2-3 2-3s2 1.4 2 3Z" />
    </svg>
  ),
  undo: (
    <svg viewBox="0 0 24 24">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  ),
  clear: (
    <svg viewBox="0 0 24 24">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  ),
};

export default function DrawingCanvas({ ref, disabled }: { ref?: Ref<CanvasHandle>; disabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const history = useRef<ImageData[]>([]);
  const last = useRef<[number, number] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState(COLORS[0]);
  const [custom, setCustom] = useState("#2f6fed");
  const [size, setSize] = useState(8);

  const ctx = () => canvasRef.current!.getContext("2d", { willReadFrequently: true })!;

  const wipe = useCallback(() => {
    const c = ctx();
    c.fillStyle = PAPER;
    c.fillRect(0, 0, W, H);
  }, []);

  useEffect(() => wipe(), [wipe]);

  const snap = () => {
    history.current.push(ctx().getImageData(0, 0, W, H));
    if (history.current.length > 30) history.current.shift();
  };

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (prev) ctx().putImageData(prev, 0, 0);
  }, []);

  useImperativeHandle(ref, () => ({
    toJpeg: () => canvasRef.current!.toDataURL("image/jpeg", 0.85),
    isBlank: () => !dirty,
    reset: () => {
      wipe();
      history.current = [];
      setDirty(false);
    },
  }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && history.current.length) {
        e.preventDefault();
        undo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo]);

  const pos = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height];
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pos(e);
    snap();
    setDirty(true);
    if (tool === "fill") {
      floodFill(ctx(), Math.min(W - 1, Math.max(0, Math.floor(p[0]))), Math.min(H - 1, Math.max(0, Math.floor(p[1]))), color);
      return;
    }
    const c = ctx();
    last.current = p;
    c.strokeStyle = c.fillStyle = tool === "eraser" ? PAPER : color;
    c.lineWidth = size;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.arc(p[0], p[1], size / 2, 0, Math.PI * 2);
    c.fill();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    const c = ctx();
    const evs = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of evs.length ? evs : [e.nativeEvent]) {
      const p = pos(ev);
      c.beginPath();
      c.moveTo(last.current[0], last.current[1]);
      c.lineTo(p[0], p[1]);
      c.stroke();
      last.current = p;
    }
  };

  const end = () => {
    last.current = null;
  };

  const pick = (c: string) => {
    setColor(c);
    if (tool === "eraser") setTool("brush");
  };

  const toolBtn = (t: Tool, label: string) => (
    <button className="tool" aria-pressed={tool === t} type="button" onClick={() => setTool(t)}>
      {ICONS[t]}
      <span className="tl">{label}</span>
    </button>
  );

  return (
    <>
      <div className="toolbar" role="toolbar" aria-label="Drawing tools">
        {toolBtn("brush", "Brush")}
        {toolBtn("eraser", "Eraser")}
        {toolBtn("fill", "Fill")}
        <span className="sep" />
        <button className="tool" type="button" onClick={undo} disabled={disabled}>
          {ICONS.undo}
          <span className="tl">Undo</span>
        </button>
        <button
          className="tool"
          type="button"
          disabled={disabled}
          onClick={() => {
            snap();
            wipe();
            setDirty(false);
          }}
        >
          {ICONS.clear}
          <span className="tl">Clear</span>
        </button>
        <div className="size">
          <label htmlFor="size" style={{ margin: 0 }}>
            Size
          </label>
          <input type="range" id="size" min={1} max={40} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          <output htmlFor="size">{size}</output>
        </div>
      </div>
      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          aria-label="Drawing canvas"
          className={disabled ? "locked" : undefined}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={end}
          onPointerCancel={end}
        />
        <div className="canvas-hint" style={{ opacity: dirty ? 0 : 1 }}>
          {disabled ? "Canvas locked until the next commission" : "Draw the commission here"}
        </div>
      </div>
      <div className="swatches" role="group" aria-label="Colours">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className="sw"
            style={{ "--c": c } as React.CSSProperties}
            data-c={c}
            aria-label={`Colour ${c}`}
            aria-pressed={color === c}
            onClick={() => pick(c)}
          />
        ))}
        <label className="custom" title="Custom colour" style={color === custom ? { background: custom } : undefined}>
          <input
            type="color"
            value={custom}
            aria-label="Custom colour"
            onChange={(e) => {
              setCustom(e.target.value);
              pick(e.target.value);
            }}
          />
          <span style={color === custom ? { color: "#fff" } : undefined}>+</span>
        </label>
        <span className="paper-note">800 × 600 · hand drawn only</span>
      </div>
    </>
  );
}
