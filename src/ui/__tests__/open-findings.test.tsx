/**
 * Fixes for the open audit findings (spec release-finish REQ-F01 to F10): report lines through the
 * locale files (CON-04), reviewed content loads (CON-06), the civics guess note (CON-10), the N-400
 * box reminder (CON-14) and the plural limit from the config (COR-04).
 */
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { loadAnswerKey } from "../../engine/civics-answer-key";
import { createDefaultPracticeEnv, createPracticeEngine, type AnswerKeyResult, type PracticeEnv, type PracticeState } from "../../engine/practice-flow";
import { loadPracticeConfig, matchOptionsFor } from "../../engine/practice-config";
import { parseProfiles } from "../../engine/practice-content";
import { reviewFlagProblem } from "../../engine/review-flag";
import { compareSentence, sameInflection } from "../../engine/sentence-compare";
import type { CivicsTestVersion } from "../../engine/version-selector";
import RAW_PROFILES from "../../../data/practice/profiles.json";
import { ENGLISH_MESSAGES, tEn, type MessageKey } from "../../i18n";
import { I18nProvider } from "../../i18n/react";
import { isLegalKey } from "../../i18n/legal-keys";
import { ReportScreen } from "../screens/ReportScreen";
import { AnswerInput } from "../components/AnswerInput";
import { CivicsScreen } from "../screens/CivicsScreen";

function quietKey(version: CivicsTestVersion): AnswerKeyResult {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return { status: "ready", key: loadAnswerKey(version, { production: false }) };
  } finally {
    warn.mockRestore();
  }
}
const KEYS = { "2008": quietKey("2008"), "2025": quietKey("2025") };
const env: PracticeEnv = { ...createDefaultPracticeEnv(), answerKey: (v) => KEYS[v] };
const engine = createPracticeEngine(env);
const AT = "2026-11-20T10:00:00.000Z";
const PROFILE = env.content.profiles[0]!.id;

/** A full practice interview, everything answered wrongly, to the report. */
function fullReport(): PracticeState {
  let s = engine.reduce(engine.initial(), { type: "choose", mode: "full", seed: 3, at: AT });
  s = engine.reduce(s, { type: "start", profileId: PROFILE, filedOn: "before", seed: 3, at: AT });
  s = engine.reduce(s, { type: "answerN400", questionId: "n400-001", questionText: "Q?", transcript: "x", at: AT });
  s = engine.reduce(s, { type: "finishN400", at: AT });
  for (const kind of ["reading", "writing"] as const) {
    for (;;) {
      const p = engine.englishProgress(s, kind);
      if (p.done || p.current === null) break;
      s = engine.reduce(s, { type: kind === "reading" ? "submitReading" : "submitWriting", transcript: "zzz", input: "typed", at: AT });
    }
    s = engine.reduce(s, { type: "continue", at: AT });
  }
  for (;;) {
    const p = engine.civicsProgress(s);
    if (p.done || p.current === null) break;
    s = engine.reduce(s, { type: "submitCivics", response: "zzz", input: "typed", at: AT });
  }
  return engine.reduce(s, { type: "continue", at: AT });
}

describe("CON-04: report summaries through the locale files", () => {
  const s = fullReport();
  const report = s.report!;
  it("every stage has lines with known keys; in English they equal the summary", () => {
    for (const stage of report.stageSummaries) {
      expect(stage.summaryLines?.length, stage.stage).toBeGreaterThan(0);
      for (const l of stage.summaryLines!) expect(Object.prototype.hasOwnProperty.call(ENGLISH_MESSAGES, l.key), l.key).toBe(true);
      expect(stage.summaryLines!.map((l) => tEn(l.key as MessageKey, l.params)).join(" ")).toBe(stage.summary);
    }
  });
  it("numbers are placeholders, not text in the keys; no summary line is a legal key", () => {
    for (const stage of report.stageSummaries)
      for (const l of stage.summaryLines!) {
        expect(isLegalKey(l.key), l.key).toBe(false);
        for (const v of Object.values(l.params ?? {})) if (typeof v === "string") expect(v).not.toMatch(/^\d+$/);
      }
  });
  it("in Vietnamese the report shows translated lines and the English disclaimer", () => {
    const session = engine.buildSession(s)!;
    const html = renderToString(
      <I18nProvider language="vi">
        <ReportScreen session={session} />
      </I18nProvider>
    );
    expect(html).toContain("Số câu đọc đúng:");
    expect(html).not.toContain("Reading sentences read correctly:");
    expect(html).toContain("Hãy luyện đọc to các câu.");
    expect(html).toContain(report.disclaimer.replace(/'/g, "&#x27;"));
  });
  it("an older report without lines still shows its English summary", () => {
    const session = engine.buildSession(s)!;
    const old = { ...session, finalReport: { ...report, stageSummaries: report.stageSummaries.map(({ summaryLines: _l, ...rest }) => rest) } };
    const html = renderToString(
      <I18nProvider language="vi">
        <ReportScreen session={old} />
      </I18nProvider>
    );
    expect(html).toContain('lang="en">Reading sentences read correctly:');
  });
});

describe("CON-06: reviewed content may load", () => {
  it("false needs a named reviewer and an ISO date; true always loads", () => {
    expect(reviewFlagProblem({ needsHumanReview: true })).toBeNull();
    expect(reviewFlagProblem({ needsHumanReview: false, reviewedBy: "A. Reviewer", reviewedOn: "2026-11-20" })).toBeNull();
    expect(reviewFlagProblem({ needsHumanReview: false })).toMatch(/reviewedBy/);
    expect(reviewFlagProblem({ needsHumanReview: false, reviewedBy: " ", reviewedOn: "2026-11-20" })).toMatch(/reviewedBy/);
    expect(reviewFlagProblem({ needsHumanReview: false, reviewedBy: "A", reviewedOn: "2026-02-30" })).toMatch(/reviewedOn/);
    expect(reviewFlagProblem({ needsHumanReview: "no" })).toMatch(/true or false/);
  });
  it("a reviewed profiles file loads; an unnamed review does not", () => {
    const base = RAW_PROFILES as unknown as Record<string, unknown>;
    expect(() => parseProfiles({ ...base, needsHumanReview: false, reviewedBy: "A. Reviewer", reviewedOn: "2026-11-20" })).not.toThrow();
    expect(() => parseProfiles({ ...base, needsHumanReview: false })).toThrow(/reviewedBy/);
  });
});

describe("CON-10 and CON-14: the two notes", () => {
  it("a voice answer with several guesses says the closest one is shown", () => {
    let s = engine.reduce(engine.initial(), { type: "choose", mode: "civics", seed: 1, at: AT });
    s = engine.reduce(s, { type: "start", filedOn: "before", seed: 1, at: AT });
    s = engine.reduce(s, { type: "submitCivics", response: "zzz", alternatives: ["yyy", "xxx"], input: "voice", at: AT });
    const html = renderToString(
      <CivicsScreen progress={engine.civicsProgress(s)} version="2008" onSubmit={() => {}} onContinue={() => {}} onRestart={() => {}} showFeedbackInitially pictureFor={() => null} />
    );
    expect(html).toContain(ENGLISH_MESSAGES["civics.heard.closest"]);
  });
  it("the N-400 box carries the reminder, read with the box", () => {
    const html = renderToString(<AnswerInput label="Your answer" submitLabel="Save" voice={false} onSubmit={() => {}} hint="Answer as the fictional person." />);
    const describedBy = /<textarea[^>]*aria-describedby="([^"]+)"/.exec(html)![1]!.split(" ");
    expect(describedBy).toHaveLength(2);
    expect(html).toContain(`id="${describedBy[0]}" class="note field__hint">Answer as the fictional person.<`);
    expect(isLegalKey("n400.box.reminder")).toBe(true);
  });
});

describe("COR-04: the plural limit comes from the config", () => {
  it("the config value is used; a larger value turns the short plural off", () => {
    const config = loadPracticeConfig();
    expect(config.sentenceMatch.pluralMinLetters).toBe(3);
    const options = matchOptionsFor(config, "reading");
    expect(compareSentence("We pay taxes", "We pay tax", options).isCorrect).toBe(true);
    expect(sameInflection("tax", "taxes", new Set(), 3)).toBe(true);
    expect(sameInflection("tax", "taxes", new Set(), 4)).toBe(false);
  });
});
