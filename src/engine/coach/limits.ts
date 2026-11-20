/**
 * src/engine/coach/limits.ts
 *
 * Request checks and cost maths of the AI coach endpoint (spec REQ-C10). Values come from
 * data/coach-config.json.
 *
 * Pure module: no DOM, no network.
 */
import type { CoachConfig } from "./config.js";
import type { CoachTurn } from "./types.js";

/** POST is the only method that does anything; OPTIONS gets 204 with no CORS grant. */
export function methodCheck(method: string): "ok" | "options" | "not_allowed" {
  const m = method.toUpperCase();
  if (m === "POST") return "ok";
  if (m === "OPTIONS") return "options";
  return "not_allowed";
}

/**
 * The Origin must be one of the configured origins, or a preview of this Pages project
 * (https://<id>.language-lab-ade.pages.dev). A missing Origin is refused. Sec-Fetch-Site, when the
 * browser sends it, must be same-origin. This stops other web pages, not scripts.
 */
export function originAllowed(origin: string | null, secFetchSite: string | null, config: CoachConfig): boolean {
  if (secFetchSite !== null && secFetchSite !== "same-origin") return false;
  if (origin === null || origin === "") return false;
  if (config.origins.exact.includes(origin)) return true;
  const preview = /^https:\/\/([a-z0-9-]+)(\.[a-z0-9.-]+)$/.exec(origin);
  return preview !== null && preview[2] === config.origins.previewSuffix;
}

/** YYYY-MM-DD in UTC. */
export const utcDay = (now: Date): string => now.toISOString().slice(0, 10);
/** YYYY-MM-DDTHH in UTC. */
export const utcHour = (now: Date): string => now.toISOString().slice(0, 13);
/** The day before `day` (for cleanup: keep today and yesterday). */
export function previousDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDay(d);
}

/** Micro-dollars (integers), so counters never carry floating-point drift. */
export const usdToMicro = (usd: number): number => Math.round(usd * 1_000_000);

/** The most a call can cost: estimated input (fixed part + text length) and the full max_tokens output. */
export function worstCaseMicroUsd(turn: CoachTurn, config: CoachConfig): number {
  const chars = turn.profileName.length + turn.question.length + (turn.sampleAnswer?.length ?? 0) + turn.answer.length;
  const inputTokens = config.limits.fixedInputTokens + Math.ceil(chars / config.limits.charsPerToken);
  return Math.ceil(inputTokens * config.model.inputUsdPerMillionTokens + config.model.maxTokens * config.model.outputUsdPerMillionTokens);
}

/** The actual cost from the API's usage numbers. */
export function actualMicroUsd(inputTokens: number, outputTokens: number, config: CoachConfig): number {
  return Math.ceil(inputTokens * config.model.inputUsdPerMillionTokens + outputTokens * config.model.outputUsdPerMillionTokens);
}
