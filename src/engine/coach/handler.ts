/**
 * src/engine/coach/handler.ts
 *
 * POST /api/coach (spec REQ-C02 to REQ-C13). The Pages Function in functions/api/coach.ts only
 * builds the dependencies and calls `handleCoachRequest`; everything that decides lives here and is
 * tested with a mocked model and an in-memory counter store. Nothing here calls the network: the
 * model call is injected.
 *
 * The client sends ids, not text, for the profile and the question: the server looks them up in
 * the practice content, so the only free text that reaches the model is the learner's answer.
 *
 * Never logged: the request body, the answer, the reply, upstream error bodies, the key, the IP.
 */
import type { CoachConfig } from "./config.js";
import { screenIdentifiers } from "./identifier-screen.js";
import { methodCheck, originAllowed, previousDay, usdToMicro, utcDay, utcHour, worstCaseMicroUsd, actualMicroUsd } from "./limits.js";
import { buildModelRequest, type ModelRequest } from "./prompt.js";
import { checkReply, type DenyList } from "./reply-check.js";
import { createD1CounterStore, type CounterStore, type D1Like } from "./counters.js";
import type { CoachResponseBody, CoachTurn } from "./types.js";

export interface CoachEnv {
  COACH_ENABLED?: string;
  ANTHROPIC_API_KEY?: string;
  COACH_IP_SALT?: string;
  COACH_DB?: D1Like;
}

export type ModelCallResult =
  | { kind: "ok"; text: string; stopReason: string | null; inputTokens: number; outputTokens: number }
  | { kind: "timeout" }
  | { kind: "error"; status: number | null };

/** What the practice content provides: fictional profiles and scripted N-400 questions. */
export interface CoachContent {
  profiles: ReadonlyArray<{ id: string; displayName: string }>;
  n400Questions: ReadonlyArray<{ id: string; text: string; sampleAnswers: Readonly<Record<string, string>> }>;
}

export interface CoachDeps {
  config: CoachConfig;
  deny: DenyList;
  content: CoachContent;
  callModel(body: ModelRequest, apiKey: string, apiVersion: string, timeoutMs: number): Promise<ModelCallResult>;
  now(): Date;
  /** Hex SHA-256 of a string. */
  sha256(text: string): Promise<string>;
  /** Defaults to the D1 store on env.COACH_DB. */
  store?(db: D1Like): CounterStore;
  /** One line per request: status and reason code only. */
  log?(line: string): void;
}

/** Security headers of every response (REQ-C02): `_headers` does not reach Functions. */
export const COACH_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

function respond(status: number, body: CoachResponseBody | null, log?: (line: string) => void): Response {
  const reason = body && "reason" in body ? body.reason : "";
  log?.(`coach ${body?.status ?? "options"} ${reason}`.trim());
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { ...COACH_RESPONSE_HEADERS } });
}

/** Read the body, stopping as soon as it is longer than `max` bytes. Null when it is too long. */
async function readLimited(request: Request, max: number): Promise<string | null> {
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

interface ParsedBody {
  sessionId: string;
  profileId: string;
  questionId: string;
  answer: string;
}
function parseBody(text: string): ParsedBody | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const keys = Object.keys(r).sort().join(",");
  if (keys !== "answer,profileId,questionId,sessionId") return null;
  const { sessionId, profileId, questionId, answer } = r;
  if (typeof sessionId !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(sessionId)) return null;
  if (typeof profileId !== "string" || profileId.length > 80) return null;
  if (typeof questionId !== "string" || questionId.length > 40) return null;
  if (typeof answer !== "string") return null;
  return { sessionId, profileId, questionId, answer };
}

export async function handleCoachRequest(request: Request, env: CoachEnv, deps: CoachDeps): Promise<Response> {
  const { config, log } = deps;
  const method = methodCheck(request.method);
  if (method === "options") return respond(204, null, log);
  if (method === "not_allowed") return respond(405, { status: "method" }, log);
  if (!originAllowed(request.headers.get("Origin"), request.headers.get("Sec-Fetch-Site"), config)) return respond(403, { status: "forbidden" }, log);
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declared) && declared > config.limits.maxRequestBytes) return respond(413, { status: "too_large" }, log);
  const text = await readLimited(request, config.limits.maxRequestBytes);
  if (text === null) return respond(413, { status: "too_large" }, log);

  if (env.COACH_ENABLED !== "true") return respond(503, { status: "unavailable", reason: "off" }, log);
  const apiKey = env.ANTHROPIC_API_KEY;
  const salt = env.COACH_IP_SALT;
  if (!apiKey || !salt || salt.length < 16 || !env.COACH_DB) return respond(503, { status: "unavailable", reason: "not_configured" }, log);

  const body = parseBody(text);
  if (body === null) return respond(400, { status: "refused", reason: "bad_request" }, log);
  const profile = deps.content.profiles.find((p) => p.id === body.profileId);
  const question = deps.content.n400Questions.find((q) => q.id === body.questionId);
  if (!profile || !question) return respond(400, { status: "refused", reason: "bad_request" }, log);
  const answer = body.answer.trim();
  if (answer === "") return respond(400, { status: "refused", reason: "empty" }, log);
  if (answer.length > config.limits.maxAnswerChars) return respond(400, { status: "refused", reason: "too_long" }, log);
  const found = screenIdentifiers(answer);
  if (found !== null) return respond(400, { status: "refused", reason: "identifier", kind: found }, log);
  const turn: CoachTurn = {
    profileName: profile.displayName,
    question: question.text,
    sampleAnswer: question.sampleAnswers[profile.id] ?? null,
    answer,
  };

  const now = deps.now();
  const day = utcDay(now);
  const store = (deps.store ?? createD1CounterStore)(env.COACH_DB);
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const worst = worstCaseMicroUsd(turn, config);
  const spendKey = `spend:${day}`;
  try {
    const ipHash = await deps.sha256(`${ip}:${day}:${salt}`);
    if (!(await store.increment(`day:${day}`, day, config.limits.dailyRequestBudget))) return finish(503, { status: "unavailable", reason: "budget" });
    if (!(await store.increment(`ipd:${ipHash}`, day, config.limits.perIpPerDay))) return finish(429, { status: "limited", reason: "ip" });
    if (!(await store.increment(`iph:${ipHash}:${utcHour(now).slice(11)}`, day, config.limits.perIpPerHour))) return finish(429, { status: "limited", reason: "ip" });
    if (!(await store.increment(`ses:${body.sessionId}:${day}`, day, config.limits.maxTurnsPerSession))) return finish(429, { status: "limited", reason: "session" });
    if (!(await store.reserve(spendKey, day, worst, usdToMicro(config.limits.dailySpendCapUsd)))) return finish(503, { status: "unavailable", reason: "spend" });
  } catch {
    return respond(503, { status: "unavailable", reason: "store" }, log);
  }

  let result: ModelCallResult;
  try {
    result = await deps.callModel(buildModelRequest(turn, config), apiKey, config.model.apiVersion, config.limits.upstreamTimeoutMs);
  } catch {
    result = { kind: "error", status: null };
  }
  // The full reserve stays on a timeout or an error: the call may still be billed.
  if (result.kind === "timeout") return finish(504, { status: "unavailable", reason: "timeout" });
  if (result.kind === "error") return finish(502, { status: "unavailable", reason: "upstream" });

  const actual = actualMicroUsd(result.inputTokens, result.outputTokens, config);
  try {
    await store.refund(spendKey, worst - actual);
  } catch {
    // The reserve stays; counting too much spend is the safe side.
  }
  const check = checkReply(result.text, result.stopReason, config, deps.deny, [profile.displayName]);
  if (!check.ok) return finish(502, { status: "rejected", reason: check.reason });
  return finish(200, { status: "ok", reply: check.reply });

  async function finish(status: number, response: CoachResponseBody): Promise<Response> {
    try {
      await store.cleanup(previousDay(day), config.limits.cleanupBatch);
    } catch {
      // Cleanup is best effort; it runs again on the next request.
    }
    return respond(status, response, log);
  }
}
