"use client";

import { useEffect, useState } from "react";
import { FramedArt } from "@/components/Placard";
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

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-10 sm:px-6">
      <header className="mb-10 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gold)]">The Permanent Collection</div>
        <h1 className="mt-3 font-serif text-4xl sm:text-6xl">Hall of Winners</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--muted)]">
          Every piece here was drawn by a human in five minutes, chosen by the Curator, and paid for in SOL.
          {total !== null && ` ${total} work${total === 1 ? "" : "s"} on display.`}
        </p>
      </header>

      {total === 0 && <p className="text-center text-[var(--muted)]">The walls are still bare. Go make history.</p>}

      <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((e) => (
          <FramedArt key={e.round} entry={e} />
        ))}
      </div>

      {total !== null && entries.length < total && (
        <div className="mt-12 text-center">
          <button onClick={() => setPage((p) => p + 1)} disabled={loading} className="rounded-lg border border-[var(--gold)] px-6 py-2.5 text-sm text-[var(--gold)] hover:bg-[var(--gold)]/10 disabled:opacity-50">
            {loading ? "Loading…" : "Explore more halls"}
          </button>
        </div>
      )}
    </main>
  );
}
