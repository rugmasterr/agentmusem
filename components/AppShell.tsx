"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type PhantomProvider = {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  on?: (event: string, cb: (arg?: { toString(): string } | null) => void) => void;
};

type Shell = {
  pubkey: string | null;
  connect: () => Promise<string | null>;
  toast: (msg: string) => void;
};

const ShellContext = createContext<Shell>({ pubkey: null, connect: async () => null, toast: () => {} });
export const useShell = () => useContext(ShellContext);

export const shortAddr = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

function provider(): PhantomProvider | null {
  const w = window as unknown as { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider };
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  if (w.solana?.isPhantom) return w.solana;
  return null;
}

const LINKS = [
  { href: "/", label: "Studio" },
  { href: "/submissions", label: "Submissions" },
  { href: "/museum", label: "Museum" },
  { href: "/#how", label: "How it works" },
  { href: "/#fees", label: "Fees" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastOn(false), 3000);
  }, []);

  const connect = useCallback(async () => {
    const p = provider();
    if (!p) {
      toast("Phantom not detected. Install it from phantom.com and reload.");
      return null;
    }
    try {
      const r = await p.connect();
      const k = r.publicKey.toString();
      setPubkey(k);
      toast("Wallet connected");
      return k;
    } catch {
      toast("Connection request was cancelled");
      return null;
    }
  }, [toast]);

  const disconnect = async () => {
    try {
      await provider()?.disconnect();
    } catch {}
    setPubkey(null);
    toast("Wallet disconnected");
  };

  useEffect(() => {
    const p = provider();
    if (!p) return;
    p.connect({ onlyIfTrusted: true })
      .then((r) => setPubkey(r.publicKey.toString()))
      .catch(() => {});
    p.on?.("accountChanged", (k) => setPubkey(k ? k.toString() : null));
    p.on?.("disconnect", () => setPubkey(null));
  }, []);

  return (
    <ShellContext.Provider value={{ pubkey, connect, toast }}>
      <div className="wrap navbar">
        <div className="glass">
          <Link className="logo" href="/">
            <span className="mark">
              <svg viewBox="0 0 24 24">
                <path d="M3 10l9-6 9 6M5 10v9M9.5 10v9M14.5 10v9M19 10v9M3 20h18" />
              </svg>
            </span>
            Agent Museum
          </Link>
          <nav className="navlinks" aria-label="Pages">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={pathname === l.href ? "on" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          <button className="btn btn-glass wallet" type="button" onClick={() => (pubkey ? disconnect() : connect())}>
            {pubkey ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                <span className="live-dot" />
                <span style={{ fontFamily: "var(--mono)", fontSize: 13.5 }}>{shortAddr(pubkey)}</span>
              </span>
            ) : (
              <>
                <span className="ph">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#fff"
                      d="M12 3c-4.8 0-8.5 3.7-8.5 8.4v8c0 .8.9 1.2 1.5.8l1.2-.9c.4-.3.9-.3 1.3 0l1.3 1c.4.3.9.3 1.3 0l1.3-1c.4-.3.9-.3 1.3 0l1.3 1c.4.3.9.3 1.3 0l1.3-1c.4-.3.9-.3 1.3 0l1.2.9c.6.4 1.5 0 1.5-.8v-8C20.5 6.7 16.8 3 12 3Zm-2.8 9.7a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm5.6 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z"
                    />
                  </svg>
                </span>
                <span>
                  <span className="wl">Connect </span>Phantom
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {children}

      <div className="wrap">
        <footer>
          <span>© 2026 Agent Museum</span>
          <span>Payouts in SOL on Solana.</span>
        </footer>
      </div>

      <div className={`glass toast${toastOn ? " show" : ""}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </ShellContext.Provider>
  );
}

/** Scroll-reveal for `.rv` elements, matching the original page's IntersectionObserver behavior. */
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const els = [...document.querySelectorAll<HTMLElement>(".rv:not([data-rv])")];
    const vh = innerHeight;
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.remove("pre");
            io.unobserve(en.target);
          }
        }),
      { threshold: 0.12 },
    );
    els.forEach((el) => {
      el.dataset.rv = "1";
      if (el.getBoundingClientRect().top > vh) el.classList.add("pre");
      io.observe(el);
    });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
