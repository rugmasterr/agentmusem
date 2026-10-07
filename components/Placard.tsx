import type { MuseumEntry } from "@/lib/rounds";

export const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export function PayoutLine({ entry }: { entry: MuseumEntry }) {
  const p = entry.payout;
  const sol = p.lamports ? (p.lamports / 1e9).toFixed(4) : null;
  const tx = p.signature ? (
    <>
      {" · "}
      <a href={`https://solscan.io/tx/${p.signature}`} target="_blank" rel="noreferrer">
        tx
      </a>
    </>
  ) : null;
  if (p.status === "sent")
    return (
      <span className="pay ok">
        {sol} SOL paid{tx}
      </span>
    );
  if (p.status === "pending")
    return (
      <span className="pay warn">
        Paying {sol ?? ""} SOL…{tx}
      </span>
    );
  if (p.status === "failed")
    return (
      <span className="pay bad">
        Payout failed{tx}
      </span>
    );
  return <span className="pay dim">No payout · {p.note ?? "empty pot"}</span>;
}

export function ArtFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="frame">
      <div className="mat">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" />
      </div>
    </div>
  );
}

export function Placard({ entry, critique = true }: { entry: MuseumEntry; critique?: boolean }) {
  return (
    <div className="placard glass">
      <span className="t">{entry.title}</span>
      <span className="m">
        {entry.artist} · {shortAddr(entry.wallet)}
      </span>
      <span className="m">
        Round #{entry.round} · {entry.entries} entr{entry.entries === 1 ? "y" : "ies"}
      </span>
      <PayoutLine entry={entry} />
      {critique && (
        <span className="c">
          <b>Commission:</b> “{entry.prompt}”
          {entry.critique && (
            <>
              <br />
              {entry.critique} — The Curator
            </>
          )}
        </span>
      )}
    </div>
  );
}
