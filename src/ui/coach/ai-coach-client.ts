/**
 * src/ui/coach/ai-coach-client.ts
 *
 * The browser side of the optional AI coach (spec REQ-C07, REQ-C08, REQ-C11). This is the only
 * code that calls /api/coach, and only from `submit`, only after the learner has confirmed the
 * notice. Consent, the session id and the turn count live in memory: a new practice starts with
 * the coach off.
 *
 * Only the current answer's text goes out, with the ids of the fictional profile and the scripted
 * question (the server looks the texts up itself). Never audio, never earlier answers.
 */
import type { CoachConfig } from "../../engine/coach/config";
import { screenIdentifiers } from "../../engine/coach/identifier-screen";
import type { CoachFallbackReason, CoachReply, CoachResponseBody, CoachTurnResult } from "../../engine/coach/types";

export const COACH_ENDPOINT = "/api/coach";

/** `fetch` in the app; a spy in tests. */
export type CoachTransport = (url: string, init: RequestInit) => Promise<Response>;

export interface CoachTurnRequest {
  profileId: string;
  questionId: string;
  answer: string;
}

export interface AiCoachSession {
  readonly consent: boolean;
  /** False once the server said the coach is off, over budget or not set up, or the turn limit was reached. */
  readonly available: boolean;
  readonly turnsUsed: number;
  /** The learner confirmed the notice. */
  giveConsent(): void;
  /** The learner turned the switch off. */
  withdraw(): void;
  submit(turn: CoachTurnRequest): Promise<CoachTurnResult>;
}

/** 16 random bytes as hex, made when consent is given. Never stored. */
function randomSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const DISABLE: ReadonlySet<string> = new Set(["off", "not_configured", "budget", "spend"]);

function mapResponse(body: unknown): CoachTurnResult {
  const b = body as Partial<CoachResponseBody> & { reason?: string; reply?: CoachReply; kind?: string };
  const fallback = (reason: CoachFallbackReason, disable = false): CoachTurnResult => ({ kind: "fallback", reason, disable });
  switch (b?.status) {
    case "ok":
      return b.reply ? { kind: "ai", reply: b.reply } : fallback("error");
    case "refused":
      if (b.reason === "identifier" && typeof b.kind === "string") return { kind: "screened", found: b.kind as never };
      return fallback(b.reason === "too_long" ? "too_long" : "error");
    case "limited":
      return b.reason === "session" ? fallback("session_limit", true) : fallback("limited");
    case "unavailable":
      if (b.reason === "timeout") return fallback("timeout");
      return fallback("unavailable", DISABLE.has(String(b.reason)));
    case "rejected":
      return fallback("rejected");
    default:
      return fallback("error");
  }
}

export function createAiCoachSession(options: { transport: CoachTransport; config: CoachConfig; newSessionId?: () => string }): AiCoachSession {
  const { transport, config } = options;
  let consent = false;
  let available = true;
  let sessionId: string | null = null;
  let turnsUsed = 0;
  return {
    get consent() {
      return consent;
    },
    get available() {
      return available;
    },
    get turnsUsed() {
      return turnsUsed;
    },
    giveConsent() {
      if (!available) return;
      consent = true;
      sessionId ??= (options.newSessionId ?? randomSessionId)();
    },
    withdraw() {
      consent = false;
    },
    async submit(turn) {
      if (!consent || sessionId === null) return { kind: "off" };
      if (!available) return { kind: "fallback", reason: "unavailable", disable: true };
      const answer = turn.answer.trim();
      if (answer === "") return { kind: "fallback", reason: "empty", disable: false };
      if (answer.length > config.limits.maxAnswerChars) return { kind: "fallback", reason: "too_long", disable: false };
      const found = screenIdentifiers(answer);
      if (found !== null) return { kind: "screened", found };
      if (turnsUsed >= config.limits.maxTurnsPerSession) {
        available = false;
        consent = false;
        return { kind: "fallback", reason: "session_limit", disable: true };
      }
      turnsUsed += 1;
      let result: CoachTurnResult;
      try {
        const response = await transport(COACH_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, profileId: turn.profileId, questionId: turn.questionId, answer }),
          signal: AbortSignal.timeout(config.limits.clientTimeoutMs),
          credentials: "same-origin",
        });
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        result = mapResponse(body);
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        result = { kind: "fallback", reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network", disable: false };
      }
      if (result.kind === "fallback" && result.disable) {
        available = false;
        consent = false;
      }
      return result;
    },
  };
}
