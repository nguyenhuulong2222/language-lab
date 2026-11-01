/**
 * Language Lab — Session Contracts
 *
 * All types for an interview practice session.
 * This is a practice tool only. Not affiliated with USCIS or any government agency.
 * Results do not predict or reflect any official immigration decision.
 */

// ---------------------------------------------------------------------------
// Stage
// ---------------------------------------------------------------------------

/**
 * The ordered stages of a practice interview session.
 *
 * - intro:          Orientation, profile confirmation, instructions.
 * - n400_interview: Biographical question practice (N-400 topics).
 *                   English speaking ability is assessed here during conversation.
 * - reading:        English reading portion practice.
 * - writing:        English writing portion practice.
 * - civics:         Civics test questions (2008 or 2025 test version).
 * - report:         Final practice report displayed to the user.
 */
export type SessionStage =
  | "intro"
  | "n400_interview"
  | "reading"
  | "writing"
  | "civics"
  | "report";

// ---------------------------------------------------------------------------
// Turn
// ---------------------------------------------------------------------------

/**
 * A single exchange within a session stage.
 * No raw audio is stored here. No real personal details should appear in responseText.
 */
export interface Turn {
  /** Unique identifier for this turn within the session. */
  turnId: string;

  /** The stage this turn belongs to. */
  stage: SessionStage;

  /** The prompt or question presented to the user. */
  prompt: string;

  /**
   * The user's response as text (e.g. from speech-to-text or typed input).
   * Must not contain real personally identifiable information.
   */
  responseText: string;

  /**
   * Optional reference to a device-local audio recording.
   * This ID refers only to audio stored on the user's device.
   * No audio is transmitted to or stored on any server.
   */
  localRecordingId?: string;

  /** ISO 8601 timestamp of when this turn was completed. */
  completedAt: string;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Scoring result for a civics question turn.
 * Determined solely by the answer key — AI must never produce this score.
 */
export interface CivicsScoringResult {
  scoringSource: "answer_key";
  result: "correct" | "incorrect";
}

/**
 * Scoring result for a reading or writing turn.
 * Tracks number of attempts alongside the final result.
 */
export interface ReadingWritingScoringResult {
  attempts: number;
  result: "correct" | "incorrect";
}

/**
 * Feedback for an N-400 interview practice turn.
 * AI may assist in producing this feedback.
 * AI must never produce a civics score or suggest what the user should claim.
 */
export interface N400Feedback {
  feedback: "understood" | "needs_practice" | "unclear";
}

/**
 * Discriminated union of all scoring result types, keyed by stage.
 */
export type ScoringResult =
  | ({ stage: "civics" } & CivicsScoringResult)
  | ({ stage: "reading" } & ReadingWritingScoringResult)
  | ({ stage: "writing" } & ReadingWritingScoringResult)
  | ({ stage: "n400_interview" } & N400Feedback);

// ---------------------------------------------------------------------------
// Per-stage summary
// ---------------------------------------------------------------------------

export interface StageSummary {
  stage: SessionStage;
  turnsTotal: number;
  turnsScored: number;
  /** Human-readable summary of performance in this stage. */
  summary: string;
  /** Specific items recommended for further practice. */
  reviewItems: string[];
}

// ---------------------------------------------------------------------------
// Final Report
// ---------------------------------------------------------------------------

/**
 * The practice result outcome.
 * These values are intentionally not "pass" / "fail" to make clear this is practice only.
 */
export type PracticeResult = "practice_passed" | "needs_more_practice";

/**
 * The final report produced at the end of a practice session.
 *
 * IMPORTANT: practiceResult is a practice indicator only.
 * It does not predict, reflect, or guarantee any USCIS decision.
 */
export interface FinalReport {
  /** Overall practice outcome. Never use "pass" or "fail". */
  practiceResult: PracticeResult;

  /**
   * Required disclaimer. Must be displayed prominently wherever this report is shown.
   * Example value: "This is a practice tool only. It is not affiliated with USCIS or any
   * government agency. Results do not predict or reflect any official immigration decision.
   * This is not legal advice."
   */
  disclaimer: string;

  /** Per-stage performance summaries. */
  stageSummaries: StageSummary[];

  /** Topics or questions recommended for further study across all stages. */
  overallReviewItems: string[];

  /** ISO 8601 timestamp of when this report was generated. */
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Interview Session
// ---------------------------------------------------------------------------

/**
 * A complete Language Lab practice interview session.
 * All sessions use fictional profiles. No real applicant data is collected.
 */
export interface InterviewSession {
  /** Unique identifier for this session. */
  sessionId: string;

  /**
   * References a fictional applicant profile.
   * All profiles are invented for practice purposes only.
   * No real person is represented.
   */
  fictionalProfileId: string;

  /**
   * Always true. This field is a literal type to make it impossible
   * to create a session marked as non-fictional.
   */
  isFictional: true;

  /**
   * Fictional filing date used to contextualise the practice scenario.
   * ISO 8601 date string (YYYY-MM-DD). Does not represent a real filing.
   */
  filingDate: string;

  /**
   * Which civics test version this session uses.
   * "2008" = the original 100-question test.
   * "2025" = the revised test introduced in 2025.
   */
  testVersion: "2008" | "2025";

  /** ISO 8601 timestamp of when this session started. */
  startedAt: string;

  /** ISO 8601 timestamp of when this session ended. Absent if session is in progress. */
  endedAt?: string;

  /** The current active stage. */
  currentStage: SessionStage;

  /** All turns completed so far, in order. */
  turns: Turn[];

  /** Scoring results keyed by turnId. */
  scoringResults: Record<string, ScoringResult>;

  /**
   * The final report. Present only after the session reaches the "report" stage.
   */
  finalReport?: FinalReport;
}
