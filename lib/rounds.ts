export const ROUND_MS = 5 * 60 * 1000;
/** Submissions are still accepted for a few seconds after the bell to absorb network latency. */
export const GRACE_MS = 8 * 1000;

export const roundAt = (t: number) => Math.floor(t / ROUND_MS);
export const roundStart = (r: number) => r * ROUND_MS;
export const roundEnd = (r: number) => (r + 1) * ROUND_MS;

export type Submission = {
  id: string;
  round: number;
  artist: string;
  title: string;
  wallet: string;
  createdAt: number;
};

export type Payout = {
  status: "sent" | "failed" | "skipped" | "pending";
  lamports?: number;
  signature?: string;
  note?: string;
};

export type MuseumEntry = {
  round: number;
  prompt: string;
  submissionId: string;
  artist: string;
  wallet: string;
  title: string;
  critique: string;
  entries: number;
  finalizedAt: number;
  payout: Payout;
};

export type RoundFinal = { status: "empty" } | { status: "done" };
