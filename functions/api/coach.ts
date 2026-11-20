/**
 * functions/api/coach.ts — Cloudflare Pages Function for POST /api/coach (spec REQ-C02).
 *
 * Thin: it builds the dependencies (the real Anthropic call, the clock, SHA-256) and hands the
 * request to `handleCoachRequest` in src/engine/coach/handler.ts, where every check lives and is
 * tested. Bindings (set in the Pages project, see docs/coach-deploy.md):
 *   ANTHROPIC_API_KEY  secret     the Anthropic API key (never logged or returned)
 *   COACH_IP_SALT      secret     salt for the daily IP hash (at least 16 characters)
 *   COACH_ENABLED      variable   "true" turns the coach on; anything else switches it off
 *   COACH_DB           D1         the counters database
 */
import { loadCoachConfig } from "../../src/engine/coach/config";
import { handleCoachRequest, type CoachEnv, type ModelCallResult } from "../../src/engine/coach/handler";
import type { ModelRequest } from "../../src/engine/coach/prompt";
import { loadDenyList } from "../../src/engine/coach/reply-check";
import { loadPracticeContent } from "../../src/engine/practice-content";

/** The part of the Pages Functions context this handler uses. */
interface PagesContext {
  request: Request;
  env: CoachEnv;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

async function callAnthropic(body: ModelRequest, apiKey: string, apiVersion: string, timeoutMs: number): Promise<ModelCallResult> {
  let response: Response;
  try {
    response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": apiVersion },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return name === "TimeoutError" || name === "AbortError" ? { kind: "timeout" } : { kind: "error", status: null };
  }
  // The error body is not read or logged: it can echo the request.
  if (!response.ok) return { kind: "error", status: response.status };
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { kind: "error", status: response.status };
  }
  const d = data as { content?: Array<{ type?: string; text?: string }>; stop_reason?: string | null; usage?: { input_tokens?: number; output_tokens?: number } };
  const text = d.content?.find((block) => block.type === "text")?.text ?? "";
  return {
    kind: "ok",
    text,
    stopReason: d.stop_reason ?? null,
    inputTokens: d.usage?.input_tokens ?? 0,
    outputTokens: d.usage?.output_tokens ?? 0,
  };
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const config = loadCoachConfig();
const deny = loadDenyList();
const content = loadPracticeContent();

export const onRequest = (context: PagesContext): Promise<Response> =>
  handleCoachRequest(context.request, context.env, {
    config,
    deny,
    content,
    callModel: callAnthropic,
    now: () => new Date(),
    sha256,
    log: (line) => console.log(line),
  });
