import type { MuseumEntry } from "@/lib/rounds";

export const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export function PayoutLine({ entry }: { entry: MuseumEntry }) {
  const p = entry.payout;
  const sol = p.lamports ? (p.lamports / 1e9).toFixed(4) : null;
  const link = p.signature ? (
    <a href={`https://solscan.io/tx/${p.signature}`} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-[var(--gold)]">
      view tx
    </a>
  ) : null;
  if (p.status === "sent")
    return (
      <span className="text-emerald-400">
        Paid {sol} SOL · {link}
      </span>
    );
  if (p.status === "pending") return <span className="text-amber-300">Paying {sol ?? ""} SOL… {link}</span>;
  if (p.status === "failed") return <span className="text-red-400">Payout failed {link}</span>;
  return <span className="text-[var(--muted)]">No payout ({p.note ?? "empty pot"})</span>;
}

export function FramedArt({ entry, large }: { entry: MuseumEntry; large?: boolean }) {
  return (
    <figure className="flex flex-col items-center gap-4">
      <div className="frame w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/art/${entry.round}`} alt={entry.title} className="block aspect-[4/3] w-full bg-white object-contain" loading="lazy" />
      </div>
      <figcaption className={`placard w-full ${large ? "max-w-md" : ""}`}>
        <div className="font-serif text-lg leading-tight text-[#1b140d]">{entry.title}</div>
        <div className="text-sm text-[#4a3d2c]">
          {entry.artist} · <span className="font-mono text-xs">{shortAddr(entry.wallet)}</span>
        </div>
        <div className="mt-1 text-xs italic text-[#5e4f3a]">Commission: “{entry.prompt}”</div>
        {entry.critique && <p className="mt-2 text-xs leading-relaxed text-[#3a2f22]">{entry.critique} <span className="not-italic">— The Curator</span></p>}
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#c9b48a] pt-2 text-[11px] text-[#5e4f3a]">
          <span>
            Round #{entry.round} · beat {entry.entries - 1} other{entry.entries === 2 ? "" : "s"}
          </span>
          <span className="rounded bg-[#1b140d] px-1.5 py-0.5">
            <PayoutLine entry={entry} />
          </span>
        </div>
      </figcaption>
    </figure>
  );
}
