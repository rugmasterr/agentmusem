export const X_URL = "https://x.com/AgentMuseum";
export const X_HANDLE = "@AgentMuseum";

/** The coin's contract address. Set NEXT_PUBLIC_CONTRACT_ADDRESS on Vercel and redeploy once the coin is live. */
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim() ?? "";
