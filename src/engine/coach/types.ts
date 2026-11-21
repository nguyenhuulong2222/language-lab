/**
 * src/engine/coach/types.ts
 *
 * Types of the optional AI coach (spec .kiro/specs/interview-coach). Engine-local on purpose: the
 * shared contract (src/contracts/) keeps only N400Feedback, which the coach reuses; a change to the
 * contracts needs a request in docs/contract-requests.md first (decisions-log, section L).
 *
 * Pure module: types only.
 */
import type { N400Feedback } from "../../contracts/session.js";

/** One turn sent to the coach: only the current question and answer, never earlier turns. */
export interface CoachTurn {
  /** The fictional profile's display name. */
  profileName: string;
  /** The scripted N-400 question. */
  question: string;
  /** The fictional profile's sample answer to it, or null. */
  sampleAnswer: string | null;
  /** What the learner said or typed (transcript text only). */
  answer: string;
}

/** What the coach returns for a turn, after the reply check. */
export interface CoachReply {
  /** One short follow-up question an officer might ask next. Shown for practice only. */
  followUp: string;
  feedback: N400Feedback["feedback"];
  /** One short tip about the English used. */
  tip: string;
}

/** Kinds of personal identifiers the screen refuses to send. */
export type IdentifierKind = "a-number" | "ssn" | "phone" | "email" | "date-of-birth";

/** Why the client fell back to the scripted coach. */
export type CoachFallbackReason =
  | "session_limit"
  | "too_long"
  | "empty"
  | "limited"
  | "unavailable"
  | "rejected"
  | "timeout"
  | "network"
  | "error";

/** The result of one coached turn, as the screen sees it. */
export type CoachTurnResult =
  | { kind: "ai"; reply: CoachReply }
  | { kind: "screened"; found: IdentifierKind }
  | { kind: "fallback"; reason: CoachFallbackReason; /** The coach is off for the rest of the session. */ disable: boolean }
  | { kind: "off" };

/** Response bodies of POST /api/coach. */
export type CoachResponseBody =
  | { status: "ok"; reply: CoachReply }
  | { status: "refused"; reason: "identifier"; kind: IdentifierKind }
  | { status: "refused"; reason: "too_long" | "bad_request" | "empty" }
  | { status: "limited"; reason: "ip" | "session" }
  | { status: "unavailable"; reason: "off" | "not_configured" | "budget" | "spend" | "store" | "upstream" | "timeout" }
  | { status: "rejected"; reason: string }
  | { status: "forbidden" | "method" | "too_large" };
