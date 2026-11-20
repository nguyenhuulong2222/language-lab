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
 *   the rule in sentence-compare.ts with the settings of the practice config (a Language Lab
 *   practice setting based on the USCIS scoring guidelines, not a USCIS rule).
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
import { matchedAnswerCount, runCivicsStage, type CivicsStageResult } from "./civics-grader.js";
import { runEnglishStage, type EnglishStageKind, type EnglishStageResult } from "./english-grader.js";
import type { N400Answer } from "./n400-coach.js";
import { loadPracticeConfig, matchOptionsFor, type PracticeConfig } from "./practice-config.js";
import {
  loadPracticeContent,
  vocabularyWords,
  type PracticeContent,
  type PracticeSentence,
} from "./practice-content.js";
import {
  buildCivicsPartReport,
  buildEnglishPartReport,
  buildN400PartReport,
  type PartReport,
  type PracticePart,
} from "./part-report.js";
import { buildFinalReport } from "./report-builder.js";
import { compareSentence, pickBestAlternative, type MatchOptions } from "./sentence-compare.js";
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
/**
 * What the user chose on the home screen: the full practice interview, or one part.
 * Only the full interview ends with an overall practice result.
 */
export type PracticeMode = "full" | "n400" | "reading" | "writing" | "civics";

/** "home" is before a mode is chosen; "intro" is the setup screen (only some modes have one). */
export type PracticePhase =
  | "home"
  | Extract<SessionStage, "intro" | "n400_interview" | "reading" | "writing" | "civics" | "report">;

/** What a mode needs the user to choose before it can start. */
export function modeNeeds(mode: PracticeMode): { profile: boolean; filing: boolean } {
  switch (mode) {
    case "full":
      return { profile: true, filing: true };
    case "n400":
      return { profile: true, filing: false };
    case "civics":
      return { profile: false, filing: true };
    case "reading":
    case "writing":
      return { profile: false, filing: false };
  }
}

/** The practice parts of a mode, in order. */
export function modeParts(mode: PracticeMode): PracticePart[] {
  return mode === "full" ? ["n400_interview", "reading", "writing", "civics"] : [mode === "n400" ? "n400_interview" : mode];
}

/**
 * The steps of a session, in order: the setup step only when the mode needs a choice, then the
 * parts, then the report. The stepper and the take counter show exactly these.
 */
export function sessionSteps(mode: PracticeMode): SessionStage[] {
  const needs = modeNeeds(mode);
  return [...(needs.profile || needs.filing ? (["intro"] as const) : []), ...modeParts(mode), "report"];
}

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

/** The user's choices. A field is null when the chosen mode does not need it. */
export interface PracticeSetup {
  profileId: string | null;
  filedOn: FiledChoice | null;
  /** A fictional filing date derived from the choice and the boundary date. */
  filingDate: string | null;
  version: CivicsTestVersion | null;
}

export interface SentenceAttempt {
  sentenceId: string;
  /** What the user said or typed. For speech: the best-scoring alternative the recogniser gave. */
  transcript: string;
  /** How many different alternatives were scored (1 when typed). */
  alternativesScored: number;
  /** Which one was used: 0 is the recogniser's main text. */
  usedAlternative: number;
  input: InputMode;
  accuracy: number;
  isCorrect: boolean;
  /**
   * Writing only: the sentence was on screen while the user typed (they chose "Show the sentence",
   * or the audio failed). The attempt is scored the same way and recorded as assisted. Always false for reading.
   */
  assisted: boolean;
  at: string;
}

export interface CivicsAttempt {
  questionId: string;
  /** What the user said or typed. For speech: the alternative the recogniser gave that matches the answer key best. */
  response: string;
  /** How many different alternatives were scored against the answer key (1 when typed). */
  alternativesScored: number;
  input: InputMode;
  at: string;
}

export interface PracticeState {
  phase: PracticePhase;
  mode: PracticeMode | null;
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
  /** The overall report of a full practice interview. */
  report: FinalReport | null;
  /** The report of a single practised part (no overall practice result). */
  partReport: PartReport | null;
}

export type PracticeAction =
  | { type: "choose"; mode: PracticeMode; seed: number; at: string }
  | { type: "start"; profileId?: string; filedOn?: FiledChoice; seed: number; at: string }
  | { type: "answerN400"; questionId: string; questionText: string; transcript: string; at: string }
  | { type: "finishN400"; at: string }
  | { type: "submitReading"; transcript: string; alternatives?: readonly string[]; input: InputMode; at: string }
  | { type: "submitWriting"; transcript: string; alternatives?: readonly string[]; input: InputMode; assisted?: boolean; at: string }
  /** Try the sentence again: the last attempt of this part is replaced by the next one. */
  | { type: "retryEnglish" }
  | { type: "submitCivics"; response: string; alternatives?: readonly string[]; input: InputMode; at: string }
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
  /** The sentence the last attempt was for. */
  lastSentence: PracticeSentence | null;
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
  /** What the user said or typed for the latest answer. */
  lastResponse: string | null;
  /** How the latest answer was given. */
  lastInput: InputMode | null;
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

/** Static questions only (CR-003): dynamic answers change and are never practiced. */
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
export function createAnswerKeyLoader(
  load: (version: CivicsTestVersion) => ReadonlyMap<string, CivicsAnswerEntry> = (version) => loadAnswerKey(version)
): (version: CivicsTestVersion) => AnswerKeyResult {
  const cache = new Map<CivicsTestVersion, AnswerKeyResult>();
  return (version) => {
    const cached = cache.get(version);
    if (cached) return cached;
    let result: AnswerKeyResult;
    try {
      result = { status: "ready", key: load(version) };
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
    phase: "home",
    mode: null,
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
    partReport: null,
  };
}

export interface PracticeEngine {
  env: PracticeEnv;
  initial(): PracticeState;
  reduce(state: PracticeState, action: PracticeAction): PracticeState;
  englishProgress(state: PracticeState, kind: EnglishStageKind): EnglishProgress;
  civicsProgress(state: PracticeState): CivicsProgress;
  /** The settings that score a reading or writing attempt (from the practice config). */
  matchOptions(kind: EnglishStageKind): MatchOptions;
  /** The session of a full practice interview. Null for a single part (see partReport). */
  buildSession(state: PracticeState): InterviewSession | null;
}

export function createPracticeEngine(env: PracticeEnv): PracticeEngine {
  const readingById = new Map(env.content.readingSentences.map((s) => [s.id, s]));
  const writingById = new Map(env.content.writingSentences.map((s) => [s.id, s]));
  const vocabularyAll = new Set([
    ...vocabularyWords(env.content.vocabulary.reading),
    ...vocabularyWords(env.content.vocabulary.writing),
  ]);
  const matchOptions = (kind: EnglishStageKind): MatchOptions => matchOptionsFor(env.config, kind, vocabularyAll);

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
    const lastAttemptSentenceId = attempts[attempts.length - 1]?.sentenceId;
    return {
      kind,
      result,
      done,
      current: currentId === undefined ? null : (byId.get(currentId) ?? null),
      position: Math.min(attempts.length + 1, Math.max(ids.length, 1)),
      total: ids.length,
      lastAttempt: attempts[attempts.length - 1] ?? null,
      lastSentence: lastAttemptSentenceId === undefined ? null : (byId.get(lastAttemptSentenceId) ?? null),
    };
  }

  function civicsKey(state: PracticeState): AnswerKeyResult | null {
    const version = state.setup?.version;
    return version ? env.answerKey(version) : null;
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
    const version = state.setup?.version;
    if (loaded === null || loaded.status === "locked" || !version) {
      return {
        locked: state.civicsLocked || loaded?.status === "locked",
        lockReason: loaded?.status === "locked" ? loaded.reason : state.civicsLockReason,
        result: null,
        done: false,
        current: null,
        position: 0,
        total: 0,
        last: null,
        lastResponse: null,
        lastInput: null,
      };
    }
    const key = loaded.key;
    const rules = env.civicsRules(version);
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
      lastResponse: state.civics[state.civics.length - 1]?.response ?? null,
      lastInput: state.civics[state.civics.length - 1]?.input ?? null,
    };
  }

  function buildSession(state: PracticeState): InterviewSession | null {
    if (state.mode !== "full") return null;
    const setup = state.setup;
    if (setup === null || setup.profileId === null || setup.filingDate === null || setup.version === null) return null;
    if (state.startedAt === null) return null;
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
      fictionalProfileId: setup.profileId,
      isFictional: true,
      filingDate: setup.filingDate,
      testVersion: setup.version,
      startedAt: state.startedAt,
      currentStage: state.phase === "home" ? "intro" : state.phase,
      turns,
      scoringResults,
    };
    if (state.report) session.finalReport = state.report;
    return session;
  }

  // -------------------------------------------------------------------------
  // Reducer
  // -------------------------------------------------------------------------

  /** Set up a session once the mode has what it needs, and go to its first part. */
  function begin(
    mode: PracticeMode,
    choice: { profileId: string | null; filedOn: FiledChoice | null },
    seed: number,
    at: string
  ): PracticeState {
    const needs = modeNeeds(mode);
    const parts = modeParts(mode);
    const filingDate = needs.filing && choice.filedOn ? representativeFilingDate(choice.filedOn, env.boundaryDate) : null;
    const version = filingDate ? selectTestVersion(filingDate, env.boundaryDate) : null;

    let civicsIds: string[] = [];
    let civicsLocked = false;
    let civicsLockReason: string | null = null;
    if (parts.includes("civics") && version) {
      const loaded = env.answerKey(version);
      if (loaded.status === "ready") {
        civicsIds = seededShuffle(listPracticeQuestions(loaded.key), seed + 3)
          .slice(0, env.civicsRules(version).questionsAsked.value)
          .map((e) => e.id);
      } else {
        civicsLocked = true;
        civicsLockReason = loaded.reason;
      }
    }

    return {
      ...createInitialPracticeState(),
      phase: parts[0]!,
      mode,
      setup: { profileId: needs.profile ? choice.profileId : null, filedOn: needs.filing ? choice.filedOn : null, filingDate, version },
      startedAt: at,
      readingIds: parts.includes("reading")
        ? takeSentences(env.content.readingSentences, env.englishRules.reading.sentencesPresented.value, seed + 1)
        : [],
      writingIds: parts.includes("writing")
        ? takeSentences(env.content.writingSentences, env.englishRules.writing.sentencesPresented.value, seed + 2)
        : [],
      civicsIds,
      civicsLocked,
      civicsLockReason,
    };
  }

  /** The report phase for a single part, or the next part of the full interview. */
  function afterPart(state: PracticeState, next: PracticePhase, at: string): PracticeState {
    if (state.mode === "full") return { ...state, phase: next };
    return { ...state, phase: "report", partReport: partReportFor(state, at) };
  }

  function partReportFor(state: PracticeState, at: string): PartReport | null {
    const now = new Date(at);
    switch (state.mode) {
      case "n400":
        return buildN400PartReport(state.n400Answers, now);
      case "reading":
      case "writing": {
        const kind = state.mode;
        const progress = englishProgress(state, kind);
        const byId = kind === "reading" ? readingById : writingById;
        const attempts = kind === "reading" ? state.reading : state.writing;
        return buildEnglishPartReport({
          part: kind,
          result: progress.result,
          rules: env.englishRules,
          now,
          items: attempts.map((a) => ({
            sentence: byId.get(a.sentenceId)?.text ?? a.sentenceId,
            transcript: a.transcript,
            accuracy: a.accuracy,
            isCorrect: a.isCorrect,
            assisted: a.assisted,
          })),
        });
      }
      case "civics": {
        const loaded = civicsKey(state);
        const progress = civicsProgress(state);
        if (loaded?.status !== "ready" || progress.result === null || state.setup?.version == null) return null;
        return buildCivicsPartReport({
          version: state.setup.version,
          result: progress.result,
          answerKey: loaded.key,
          rules: env.civicsRules(state.setup.version),
          now,
        });
      }
      default:
        return null;
    }
  }

  function reduce(state: PracticeState, action: PracticeAction): PracticeState {
    switch (action.type) {
      case "restart":
        return createInitialPracticeState();

      case "choose": {
        if (state.phase !== "home") return state;
        const needs = modeNeeds(action.mode);
        if (needs.profile || needs.filing) {
          // Wait for the setup screen.
          return { ...createInitialPracticeState(), phase: "intro", mode: action.mode, startedAt: action.at };
        }
        return begin(action.mode, { profileId: null, filedOn: null }, action.seed, action.at);
      }

      case "start": {
        if (state.phase !== "intro" || state.mode === null) return state;
        const needs = modeNeeds(state.mode);
        if (needs.profile && !env.content.profiles.some((p) => p.id === action.profileId)) return state;
        if (needs.filing && action.filedOn === undefined) return state;
        return begin(
          state.mode,
          { profileId: action.profileId ?? null, filedOn: action.filedOn ?? null },
          action.seed,
          action.at
        );
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
        return state.phase === "n400_interview" ? afterPart(state, "reading", action.at) : state;

      case "submitReading":
      case "submitWriting": {
        const kind: EnglishStageKind = action.type === "submitReading" ? "reading" : "writing";
        if (state.phase !== kind) return state;
        const progress = englishProgress(state, kind);
        if (progress.done || progress.current === null) return state;
        const target = progress.current.text;
        const options = matchOptions(kind);
        // Spoken attempts: every alternative the recogniser gave is scored, the best one is used.
        // Typed text (or text the user edited) arrives without alternatives and is scored as it is.
        const candidates = [action.transcript, ...(action.alternatives ?? [])].filter((c, i, all) => all.indexOf(c) === i);
        const best = pickBestAlternative(candidates, (text) => compareSentence(target, text, options));
        const comparison = best.comparison;
        const attempt: SentenceAttempt = {
          sentenceId: progress.current.id,
          transcript: best.text,
          alternativesScored: candidates.length,
          usedAlternative: best.index,
          input: action.input,
          accuracy: comparison.accuracy,
          isCorrect: comparison.isCorrect,
          assisted: action.type === "submitWriting" && action.assisted === true,
          at: action.at,
        };
        return kind === "reading"
          ? { ...state, reading: [...state.reading, attempt] }
          : { ...state, writing: [...state.writing, attempt] };
      }

      case "retryEnglish": {
        if (state.phase !== "reading" && state.phase !== "writing") return state;
        const kind: EnglishStageKind = state.phase;
        const attempts = kind === "reading" ? state.reading : state.writing;
        if (attempts.length === 0) return state;
        const kept = attempts.slice(0, -1);
        return kind === "reading" ? { ...state, reading: kept } : { ...state, writing: kept };
      }
      case "submitCivics": {
        if (state.phase !== "civics") return state;
        const progress = civicsProgress(state);
        if (progress.locked || progress.done || progress.current === null) return state;
        // Spoken answers: every alternative the recogniser gave is checked against the answer key
        // (the same count that scores the answer) and the one that matches best is used.
        const candidates = [action.response, ...(action.alternatives ?? [])].filter((c, i, all) => all.indexOf(c) === i);
        const entry = progress.current;
        let response = action.response;
        if (entry.answerType === "static" && candidates.length > 1) {
          let bestCount = -1;
          for (const candidate of candidates) {
            const count = matchedAnswerCount(entry, candidate);
            if (count > bestCount) {
              bestCount = count;
              response = candidate;
            }
          }
        }
        return {
          ...state,
          civics: [
            ...state.civics,
            { questionId: entry.id, response, alternativesScored: candidates.length, input: action.input, at: action.at },
          ],
        };
      }

      case "continue": {
        if (state.setup === null || state.mode === null) return state;
        if (state.phase === "reading" && englishProgress(state, "reading").done) return afterPart(state, "writing", action.at);
        if (state.phase === "writing" && englishProgress(state, "writing").done) return afterPart(state, "civics", action.at);
        if (state.phase === "civics") {
          const progress = civicsProgress(state);
          const loaded = civicsKey(state);
          if (progress.locked || !progress.done || progress.result === null || loaded?.status !== "ready") return state;
          if (state.mode !== "full") return afterPart(state, "report", action.at);
          const session = buildSession(state);
          if (session === null || state.setup.version === null) return state;
          const report = buildFinalReport({
            session,
            civicsResult: progress.result,
            readingResult: englishProgress(state, "reading").result,
            writingResult: englishProgress(state, "writing").result,
            writingAssisted: state.writing.filter((a) => a.assisted).length,
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
    matchOptions,
    civicsProgress,
    buildSession,
  };
}
