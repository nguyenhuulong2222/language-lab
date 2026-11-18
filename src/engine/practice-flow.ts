/**
 * src/engine/practice-flow.ts
 *
 * The whole practice run as plain data and pure functions: setup, N-400 answers, reading and
 * writing attempts, civics answers, stage results, session and final report. The UI keeps one
 * PracticeState in memory (React state) and calls `engine.reduce`. Nothing is stored or sent.
 *
 * - The test version comes from the filing choice through selectTestVersion (the rules file
 *   holds the boundary date). The screens never decide 2008 or 2025.
 * - Reading and writing: runEnglishStage. Whether one sentence counts as correct uses
 *   `minWordAccuracy` from the practice config (a Language Lab setting, not a USCIS rule).
 * - Civics: runCivicsStage with the real answer key, static questions only (CR-003). The stage
 *   ends exactly where the engine ends it.
 * - The answer key loader refuses unreviewed keys in production. That refusal is not hidden or
 *   bypassed: it shows up as `civicsLocked`, and no report is built without civics.
 * - Scoring never involves AI.
 *
 * Pure module: no DOM, no network, no storage. Time and randomness come in as arguments.
 */
import type {
  FinalReport,
  InterviewSession,
  ScoringResult,
  SessionStage,
  Turn,
} from "../contracts/session.js";
import { loadAnswerKey, type CivicsAnswerEntry } from "./civics-answer-key.js";
import { runCivicsStage, type CivicsStageResult } from "./civics-grader.js";
import { runEnglishStage, type EnglishStageKind, type EnglishStageResult } from "./english-grader.js";
import type { N400Answer } from "./n400-coach.js";
import { loadPracticeConfig, type PracticeConfig } from "./practice-config.js";
import { loadPracticeContent, type PracticeContent, type PracticeSentence } from "./practice-content.js";
import { buildFinalReport } from "./report-builder.js";
import { compareSentence } from "./sentence-compare.js";
import {
  loadCivicsBoundaryDate,
  loadCivicsRules,
  loadEnglishRules,
  type CivicsTestRules,
  type EnglishTestRules,
} from "./test-rules-loader.js";
import { assertValidIsoDate, selectTestVersion, type CivicsTestVersion } from "./version-selector.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FiledChoice = "before" | "on_or_after";
export type InputMode = "voice" | "typed";
export type PracticePhase = Extract<
  SessionStage,
  "intro" | "n400_interview" | "reading" | "writing" | "civics" | "report"
>;

export type AnswerKeyResult =
  | { status: "ready"; key: ReadonlyMap<string, CivicsAnswerEntry> }
  | { status: "locked"; reason: string };

export interface PracticeEnv {
  content: PracticeContent;
  config: PracticeConfig;
  englishRules: EnglishTestRules;
  civicsRules(version: CivicsTestVersion): CivicsTestRules;
  boundaryDate: string;
  answerKey(version: CivicsTestVersion): AnswerKeyResult;
}

export interface PracticeSetup {
  profileId: string;
  filedOn: FiledChoice;
  /** A fictional filing date derived from the choice and the boundary date. */
  filingDate: string;
  version: CivicsTestVersion;
}

export interface SentenceAttempt {
  sentenceId: string;
  /** What the user said or typed. */
  transcript: string;
  input: InputMode;
  accuracy: number;
  isCorrect: boolean;
  at: string;
}

export interface CivicsAttempt {
  questionId: string;
  response: string;
  input: InputMode;
  at: string;
}

export interface PracticeState {
  phase: PracticePhase;
  setup: PracticeSetup | null;
  startedAt: string | null;
  n400Answers: N400Answer[];
  n400At: string[];
  readingIds: string[];
  writingIds: string[];
  civicsIds: string[];
  reading: SentenceAttempt[];
  writing: SentenceAttempt[];
  civics: CivicsAttempt[];
  /** The key was refused (production, needsHumanReview). Civics cannot run. */
  civicsLocked: boolean;
  civicsLockReason: string | null;
  report: FinalReport | null;
}

export type PracticeAction =
  | { type: "start"; profileId: string; filedOn: FiledChoice; seed: number; at: string }
  | { type: "answerN400"; questionId: string; questionText: string; transcript: string; at: string }
  | { type: "finishN400" }
  | { type: "submitReading"; transcript: string; input: InputMode; at: string }
  | { type: "submitWriting"; transcript: string; input: InputMode; at: string }
  | { type: "submitCivics"; response: string; input: InputMode; at: string }
  | { type: "continue"; at: string }
  | { type: "restart" };

export interface EnglishProgress {
  kind: EnglishStageKind;
  result: EnglishStageResult;
  done: boolean;
  /** The sentence waiting for an attempt, or null when the stage is done. */
  current: PracticeSentence | null;
  /** 1-based number of the current sentence. */
  position: number;
  total: number;
  lastAttempt: SentenceAttempt | null;
}

export interface CivicsProgress {
  locked: boolean;
  lockReason: string | null;
  result: CivicsStageResult | null;
  done: boolean;
  current: CivicsAnswerEntry | null;
  position: number;
  total: number;
  /** The result of the latest answer, with the question it belongs to. */
  last: { entry: CivicsAnswerEntry; result: "correct" | "incorrect" | "unscored" } | null;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** mulberry32: small deterministic generator, so tests can fix the selection. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffled copy (Fisher-Yates) that depends only on the seed. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  const next = random(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function previousDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * A fictional filing date for the choice: the day before the boundary date ("before") or the
 * boundary date itself ("on_or_after"). selectTestVersion then picks the test.
 */
export function representativeFilingDate(choice: FiledChoice, boundaryDate: string): string {
  assertValidIsoDate(boundaryDate, "boundary date");
  return choice === "before" ? previousDay(boundaryDate) : boundaryDate;
}

/** Static questions only (CR-003): dynamic answers change and are never practised. */
export function listPracticeQuestions(key: ReadonlyMap<string, CivicsAnswerEntry>): CivicsAnswerEntry[] {
  return [...key.values()].filter((entry) => entry.answerType === "static");
}

function takeSentences(
  pool: readonly PracticeSentence[],
  limit: number,
  seed: number
): string[] {
  return seededShuffle(pool, seed).slice(0, limit).map((s) => s.id);
}

function sentenceAttemptTurns(
  kind: EnglishStageKind,
  attempts: readonly SentenceAttempt[],
  sentences: ReadonlyMap<string, PracticeSentence>
): Turn[] {
  return attempts.map((attempt, index) => ({
    turnId: `${kind}-${index + 1}`,
    stage: kind,
    prompt: sentences.get(attempt.sentenceId)?.text ?? attempt.sentenceId,
    responseText: attempt.transcript,
    completedAt: attempt.at,
  }));
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Keys are loaded once per version. A refused key is remembered as locked, not retried. */
export function createAnswerKeyLoader(): (version: CivicsTestVersion) => AnswerKeyResult {
  const cache = new Map<CivicsTestVersion, AnswerKeyResult>();
  return (version) => {
    const cached = cache.get(version);
    if (cached) return cached;
    let result: AnswerKeyResult;
    try {
      result = { status: "ready", key: loadAnswerKey(version) };
    } catch (error) {
      result = { status: "locked", reason: error instanceof Error ? error.message : String(error) };
    }
    cache.set(version, result);
    return result;
  };
}

/** The real environment: content, rules, config and answer keys from the data files. */
export function createDefaultPracticeEnv(): PracticeEnv {
  return {
    content: loadPracticeContent(),
    config: loadPracticeConfig(),
    englishRules: loadEnglishRules(),
    civicsRules: (version) => loadCivicsRules(version),
    boundaryDate: loadCivicsBoundaryDate(),
    answerKey: createAnswerKeyLoader(),
  };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function createInitialPracticeState(): PracticeState {
  return {
    phase: "intro",
    setup: null,
    startedAt: null,
    n400Answers: [],
    n400At: [],
    readingIds: [],
    writingIds: [],
    civicsIds: [],
    reading: [],
    writing: [],
    civics: [],
    civicsLocked: false,
    civicsLockReason: null,
    report: null,
  };
}

export interface PracticeEngine {
  env: PracticeEnv;
  initial(): PracticeState;
  reduce(state: PracticeState, action: PracticeAction): PracticeState;
  englishProgress(state: PracticeState, kind: EnglishStageKind): EnglishProgress;
  civicsProgress(state: PracticeState): CivicsProgress;
  buildSession(state: PracticeState): InterviewSession | null;
}

export function createPracticeEngine(env: PracticeEnv): PracticeEngine {
  const readingById = new Map(env.content.readingSentences.map((s) => [s.id, s]));
  const writingById = new Map(env.content.writingSentences.map((s) => [s.id, s]));

  function englishProgress(state: PracticeState, kind: EnglishStageKind): EnglishProgress {
    const attempts = kind === "reading" ? state.reading : state.writing;
    const ids = kind === "reading" ? state.readingIds : state.writingIds;
    const byId = kind === "reading" ? readingById : writingById;
    const turns = sentenceAttemptTurns(kind, attempts, byId);
    const result = runEnglishStage({
      kind,
      rules: env.englishRules[kind],
      items: attempts.map((attempt, index) => ({ turn: turns[index]!, isCorrect: attempt.isCorrect })),
    });
    const done = result.passed || attempts.length >= ids.length;
    const currentId = done ? undefined : ids[attempts.length];
    return {
      kind,
      result,
      done,
      current: currentId === undefined ? null : (byId.get(currentId) ?? null),
      position: Math.min(attempts.length + 1, Math.max(ids.length, 1)),
      total: ids.length,
      lastAttempt: attempts[attempts.length - 1] ?? null,
    };
  }

  function civicsKey(state: PracticeState): AnswerKeyResult | null {
    return state.setup ? env.answerKey(state.setup.version) : null;
  }

  function civicsTurns(state: PracticeState, key: ReadonlyMap<string, CivicsAnswerEntry>): Turn[] {
    return state.civics.map((attempt, index) => ({
      turnId: `civics-${index + 1}`,
      stage: "civics",
      prompt: key.get(attempt.questionId)?.questionText ?? attempt.questionId,
      responseText: attempt.response,
      questionId: attempt.questionId,
      completedAt: attempt.at,
    }));
  }

  function civicsProgress(state: PracticeState): CivicsProgress {
    const loaded = civicsKey(state);
    if (loaded === null || loaded.status === "locked") {
      return {
        locked: state.civicsLocked || loaded?.status === "locked",
        lockReason: loaded?.status === "locked" ? loaded.reason : state.civicsLockReason,
        result: null,
        done: false,
        current: null,
        position: 0,
        total: 0,
        last: null,
      };
    }
    const key = loaded.key;
    const rules = env.civicsRules(state.setup!.version);
    const result = runCivicsStage({ turns: civicsTurns(state, key), answerKey: key, rules });
    const limit = Math.min(rules.questionsAsked.value, state.civicsIds.length);
    const done = result.stopReason !== "none" || state.civics.length >= limit;
    const currentId = done ? undefined : state.civicsIds[state.civics.length];
    const lastScore = result.scores[result.scores.length - 1];
    const lastEntry = lastScore ? key.get(lastScore.questionId) : undefined;
    return {
      locked: false,
      lockReason: null,
      result,
      done,
      current: currentId === undefined ? null : (key.get(currentId) ?? null),
      position: Math.min(state.civics.length + 1, Math.max(limit, 1)),
      total: limit,
      last: lastScore && lastEntry ? { entry: lastEntry, result: lastScore.scoring.result } : null,
    };
  }

  function buildSession(state: PracticeState): InterviewSession | null {
    if (state.setup === null || state.startedAt === null) return null;
    const turns: Turn[] = [];
    const scoringResults: Record<string, ScoringResult> = {};

    state.n400Answers.forEach((answer, index) => {
      turns.push({
        turnId: `n400-${index + 1}`,
        stage: "n400_interview",
        prompt: answer.questionText,
        responseText: answer.transcript,
        completedAt: state.n400At[index] ?? state.startedAt!,
      });
    });

    for (const kind of ["reading", "writing"] as const) {
      const progress = englishProgress(state, kind);
      const attempts = kind === "reading" ? state.reading : state.writing;
      const byId = kind === "reading" ? readingById : writingById;
      turns.push(...sentenceAttemptTurns(kind, attempts, byId));
      for (const score of progress.result.scores) scoringResults[score.turnId] = score.scoring;
    }

    const loaded = civicsKey(state);
    if (loaded?.status === "ready") {
      const progress = civicsProgress(state);
      turns.push(...civicsTurns(state, loaded.key));
      for (const score of progress.result?.scores ?? []) scoringResults[score.turnId] = score.scoring;
    }

    const session: InterviewSession = {
      sessionId: `practice-${state.startedAt}`,
      fictionalProfileId: state.setup.profileId,
      isFictional: true,
      filingDate: state.setup.filingDate,
      testVersion: state.setup.version,
      startedAt: state.startedAt,
      currentStage: state.phase,
      turns,
      scoringResults,
    };
    if (state.report) session.finalReport = state.report;
    return session;
  }

  function reduce(state: PracticeState, action: PracticeAction): PracticeState {
    switch (action.type) {
      case "restart":
        return createInitialPracticeState();

      case "start": {
        if (state.phase !== "intro") return state;
        if (!env.content.profiles.some((p) => p.id === action.profileId)) return state;
        const filingDate = representativeFilingDate(action.filedOn, env.boundaryDate);
        const version = selectTestVersion(filingDate, env.boundaryDate);
        const english = env.englishRules;
        const loaded = env.answerKey(version);
        const civicsIds =
          loaded.status === "ready"
            ? seededShuffle(listPracticeQuestions(loaded.key), action.seed + 3)
                .slice(0, env.civicsRules(version).questionsAsked.value)
                .map((e) => e.id)
            : [];
        return {
          ...createInitialPracticeState(),
          phase: "n400_interview",
          setup: { profileId: action.profileId, filedOn: action.filedOn, filingDate, version },
          startedAt: action.at,
          readingIds: takeSentences(env.content.readingSentences, english.reading.sentencesPresented.value, action.seed + 1),
          writingIds: takeSentences(env.content.writingSentences, english.writing.sentencesPresented.value, action.seed + 2),
          civicsIds,
          civicsLocked: loaded.status === "locked",
          civicsLockReason: loaded.status === "locked" ? loaded.reason : null,
        };
      }

      case "answerN400":
        if (state.phase !== "n400_interview") return state;
        return {
          ...state,
          n400Answers: [
            ...state.n400Answers,
            { questionId: action.questionId, questionText: action.questionText, transcript: action.transcript },
          ],
          n400At: [...state.n400At, action.at],
        };

      case "finishN400":
        return state.phase === "n400_interview" ? { ...state, phase: "reading" } : state;

      case "submitReading":
      case "submitWriting": {
        const kind: EnglishStageKind = action.type === "submitReading" ? "reading" : "writing";
        if (state.phase !== kind) return state;
        const progress = englishProgress(state, kind);
        if (progress.done || progress.current === null) return state;
        const comparison = compareSentence(
          progress.current.text,
          action.transcript,
          env.config.sentenceMatch[kind].minWordAccuracy
        );
        const attempt: SentenceAttempt = {
          sentenceId: progress.current.id,
          transcript: action.transcript,
          input: action.input,
          accuracy: comparison.accuracy,
          isCorrect: comparison.isCorrect,
          at: action.at,
        };
        return kind === "reading"
          ? { ...state, reading: [...state.reading, attempt] }
          : { ...state, writing: [...state.writing, attempt] };
      }

      case "submitCivics": {
        if (state.phase !== "civics") return state;
        const progress = civicsProgress(state);
        if (progress.locked || progress.done || progress.current === null) return state;
        return {
          ...state,
          civics: [
            ...state.civics,
            { questionId: progress.current.id, response: action.response, input: action.input, at: action.at },
          ],
        };
      }

      case "continue": {
        if (state.setup === null) return state;
        if (state.phase === "reading" && englishProgress(state, "reading").done) return { ...state, phase: "writing" };
        if (state.phase === "writing" && englishProgress(state, "writing").done) return { ...state, phase: "civics" };
        if (state.phase === "civics") {
          const progress = civicsProgress(state);
          const loaded = civicsKey(state);
          if (progress.locked || !progress.done || progress.result === null || loaded?.status !== "ready") return state;
          const session = buildSession(state);
          if (session === null) return state;
          const report = buildFinalReport({
            session,
            civicsResult: progress.result,
            readingResult: englishProgress(state, "reading").result,
            writingResult: englishProgress(state, "writing").result,
            answerKey: loaded.key,
            rules: { civics: env.civicsRules(state.setup.version), english: env.englishRules },
            now: new Date(action.at),
          });
          return { ...state, phase: "report", report };
        }
        return state;
      }
    }
  }

  return {
    env,
    initial: createInitialPracticeState,
    reduce,
    englishProgress,
    civicsProgress,
    buildSession,
  };
}
