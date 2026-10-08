"use client";

import { useShell } from "./AppShell";
import { CONTRACT_ADDRESS, X_HANDLE, X_URL } from "@/lib/site";

export function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function XLink({ label }: { label?: boolean }) {
  return (
    <a className={`xlink${label ? " labelled" : ""}`} href={X_URL} target="_blank" rel="noreferrer" aria-label={`Agent Museum on X (${X_HANDLE})`}>
      <XIcon />
      {label && <span>{X_HANDLE}</span>}
    </a>
  );
}

/** The coin's contract address with a copy button, or a "coming soon" placeholder until it's set. */
export function ContractAddress({ compact }: { compact?: boolean }) {
  const { toast } = useShell();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      toast("Contract address copied");
    } catch {
      toast("Couldn't copy — select it manually");
    }
  };
  return (
    <div className={`ca${compact ? " compact" : ""}${CONTRACT_ADDRESS ? "" : " pending"}`}>
      <span className="ca-label">CA</span>
      {CONTRACT_ADDRESS ? (
        <>
          <code title={CONTRACT_ADDRESS}>{CONTRACT_ADDRESS}</code>
          <button type="button" onClick={copy}>
            Copy
          </button>
        </>
      ) : (
        <code>Coming soon · revealed at launch</code>
      )}
    </div>
  );
}
