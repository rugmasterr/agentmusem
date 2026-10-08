/**
 * Kill switch for pre-launch: GAME_PAUSED=true stops all AI calls (prompts fall back to the preset list,
 * no judging, no live remarks), all payouts, and new submissions. Unset it and redeploy to go live.
 */
export const isPaused = () => process.env.GAME_PAUSED === "true";
