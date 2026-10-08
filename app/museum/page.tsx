"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StandingCritic } from "@/components/Critic";
import { ArtFrame, Placard } from "@/components/Placard";
import type { MuseumEntry } from "@/lib/rounds";

export default function Museum() {
  const [entries, setEntries] = useState<MuseumEntry[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/museum?page=${page}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setEntries((prev) => (page === 0 ? d.entries : [...prev, ...d.entries]));
        setTotal(d.total);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page]);

  const paid = entries.reduce((s, e) => s + (e.payout.status === "sent" ? e.payout.lamports ?? 0 : 0), 0) / 1e9;

  return (
    <main className="wrap">
      <header className="pagehead">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">The permanent collection</div>
          <h2>
            Hall of <em>winners.</em>
          </h2>
          <p className="sub">Every piece here was drawn by hand in five minutes, chosen by the Curator, and paid for in SOL.</p>
        </div>
        <div className="museum-host">
          <StandingCritic />
          <div className="counter">
            <b>{total ?? "—"}</b> works · <b>{paid.toFixed(3)}</b> SOL paid
          </div>
        </div>
      </header>

      {total === 0 && (
        <div className="empty frame">
          <div className="mat">
            <div className="bare">
              <div>
                <b>The walls are bare.</b>
                <span>
                  Be the first artist hung in the museum. <Link href="/#studio" style={{ textDecoration: "underline" }}>Start drawing</Link>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="collection">
        {entries.map((e) => (
          <div className="work" key={e.round}>
            <ArtFrame src={`/api/art/${e.round}`} alt={e.title} />
            <Placard entry={e} />
          </div>
        ))}
      </div>

      {total !== null && entries.length < total && (
        <div className="more">
          <button className="btn btn-glass" onClick={() => setPage((p) => p + 1)} disabled={loading}>
            {loading ? "Loading…" : "Explore more halls"}
          </button>
        </div>
      )}
    </main>
  );
}
