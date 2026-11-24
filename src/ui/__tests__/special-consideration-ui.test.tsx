/**
 * The 65/20 practice on screen (spec release-finish REQ-S05 to S08): home card, setup choice,
 * Study first, civics screen and part report. Questions stay English in every language.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { loadAnswerKey } from "../../engine/civics-answer-key";
import { createDefaultPracticeEnv, createPracticeEngine, type AnswerKeyResult, type PracticeEnv } from "../../engine/practice-flow";
import { designatedQuestionIds } from "../../engine/special-consideration";
import type { CivicsTestVersion } from "../../engine/version-selector";
import { ENGLISH_MESSAGES } from "../../i18n";
import { I18nProvider } from "../../i18n/react";
import { isLegalKey } from "../../i18n/legal-keys";
import { EXCEPTIONS_URL } from "../components/SpecialConsiderationNote";
import { Screen } from "../PracticeApp";
import { HomeScreen } from "../screens/HomeScreen";
import { IntroScreen } from "../screens/IntroScreen";
import { StudyScreen } from "../screens/StudyScreen";

function quietKey(version: CivicsTestVersion): AnswerKeyResult {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return { status: "ready", key: loadAnswerKey(version, { production: false }) };
  } finally {
    warn.mockRestore();
  }
}
const KEYS = { "2008": quietKey("2008"), "2025": quietKey("2025") };
const BASE = createDefaultPracticeEnv();
const env: PracticeEnv = { ...BASE, answerKey: (v) => KEYS[v] };
const engine = createPracticeEngine(env);
const rules = env.specialRules!()!;
const AT = "2026-11-20T10:00:00.000Z";
const LABEL = "I am 65 or older and have been a permanent resident for 20 years or more";
const plain = (html: string) => html.replace(/<!-- -->/g, "").replace(/&#x27;/g, "'");

const screen = (e = engine, state = e.initial(), language: "en" | "vi" = "en") =>
  plain(
    renderToString(
      <I18nProvider language={language}>
        <Screen engine={e} state={state} dispatch={() => {}} coach={null as never} civicsLockedInBuild={false} now={() => AT} seed={() => 1} restart={() => {}} />
      </I18nProvider>
    )
  );

describe("home card (REQ-S06)", () => {
  it("offered when the rules are verified; absent when the mode is off", () => {
    expect(screen()).toContain("65/20 civics practice");
    const off = createPracticeEngine({ ...env, specialRules: () => null });
    expect(screen(off)).not.toContain("65/20 civics practice");
  });
  it("not offered while civics is locked", () => {
    const html = renderToString(<HomeScreen civicsLocked onChoose={() => {}} onChooseSpecial={() => {}} />);
    expect(html).not.toContain("65/20 civics practice");
  });
});

describe("setup choice (REQ-S05, REQ-S08)", () => {
  const intro = (props: Partial<Parameters<typeof IntroScreen>[0]> = {}, language: "en" | "vi" = "en") =>
    plain(
      renderToString(
        <I18nProvider language={language}>
          <IntroScreen
            profiles={BASE.content.profiles}
            boundaryDate={BASE.boundaryDate}
            needs={{ profile: false, filing: true }}
            onStart={() => {}}
            special={{ rules, initial: false }}
            {...props}
          />
        </I18nProvider>
      )
    );
  it("the checkbox in the owner's words, off unless the home card was chosen", () => {
    const html = intro();
    expect(html).toContain(LABEL);
    const box = (h: string) => /<input[^>]*name="special"[^>]*>/.exec(h)?.[0] ?? "";
    expect(box(html)).toContain('type="checkbox"');
    expect(box(html)).not.toContain("checked");
    expect(box(intro({ special: { rules, initial: true } }))).toContain('checked=""');
  });
  it("the numbers come from the rules; the language line links the USCIS page", () => {
    const html = intro();
    expect(html).toContain("asks 10 of the 20 questions marked with a star (*)");
    expect(html).toContain("The practice passing score is 6 correct answers.");
    expect(html).toContain("A 65/20 applicant may take the real civics test in their own language with an interpreter.");
    expect(html).toContain(`href="${EXCEPTIONS_URL}"`);
    expect(html).toContain('aria-describedby="intro-special-help"');
  });
  it("no choice without the filing question (N-400, reading, writing) or when the mode is off", () => {
    expect(intro({ needs: { profile: true, filing: false } })).not.toContain(LABEL);
    const off = renderToString(
      <IntroScreen profiles={BASE.content.profiles} boundaryDate={BASE.boundaryDate} needs={{ profile: false, filing: true }} onStart={() => {}} />
    );
    expect(off).not.toContain(LABEL);
  });
  it("in Vietnamese: the eligibility label and the legal lines stay English (legal keys)", () => {
    const html = intro({}, "vi");
    expect(html).toContain(LABEL);
    expect(html).not.toContain("Tôi từ 65 tuổi trở lên");
    expect(html).toContain(ENGLISH_MESSAGES["special.language"]);
    for (const key of ["intro.special.help", "intro.special.label", "home.special.text", "special.language", "study.special.dynamic"] as const) expect(isLegalKey(key), key).toBe(true);
  });
});

describe("Study first for 65/20 (REQ-S07)", () => {
  for (const version of ["2008", "2025"] as const) {
    it(`${version}: only the designated static questions, with the count of those left out`, () => {
      const designated = designatedQuestionIds(version);
      const key = KEYS[version].status === "ready" ? KEYS[version].key : new Map();
      const statics = designated.filter((id) => key.get(id)?.answerType === "static");
      const html = plain(
        renderToString(
          <StudyScreen answerKey={(v) => KEYS[v]} onHome={() => {}} initialVersion={version} designated={designatedQuestionIds} initialSpecialOnly />
        )
      );
      expect(html).toContain(`Question 1 of ${statics.length}`);
      expect(html).toContain(key.get(statics[0]!)!.questionText);
      expect(html).toContain(`${designated.length - statics.length} of the 20 questions have answers that change`);
      expect(html).toContain(`href="${EXCEPTIONS_URL}"`);
    });
  }
  it("the version choice offers the 65/20 option only when given", () => {
    const withOption = renderToString(<StudyScreen answerKey={(v) => KEYS[v]} onHome={() => {}} designated={designatedQuestionIds} />);
    expect(plain(withOption)).toContain("Only the questions for 65/20 (marked with a star)");
    const without = renderToString(<StudyScreen answerKey={(v) => KEYS[v]} onHome={() => {}} />);
    expect(without).not.toContain("65/20");
  });
});

describe("civics screen and part report (REQ-S04, REQ-S08)", () => {
  const start = () => {
    const chosen = engine.reduce(engine.initial(), { type: "choose", mode: "civics", seed: 1, at: AT, specialConsideration: true });
    return engine.reduce(chosen, { type: "start", filedOn: "on_or_after", specialConsideration: true, seed: 1, at: AT });
  };
  it("the first question names the 65/20 practice; the question is English in Vietnamese too", () => {
    const s = start();
    const first = engine.civicsProgress(s).current!;
    expect(screen(engine, s)).toContain("asks 10 of the 20 questions");
    const vi = screen(engine, s, "vi");
    expect(vi).toContain(`lang="en">${first.questionText.replace(/'/g, "'")}`);
    expect(vi).toContain(ENGLISH_MESSAGES["special.language"]);
  });
  it("the part report says 65/20 and the needed count of 6", () => {
    let s = start();
    for (;;) {
      const p = engine.civicsProgress(s);
      if (p.done || p.current === null) break;
      s = engine.reduce(s, { type: "submitCivics", response: "zzz", input: "typed", at: AT });
    }
    s = engine.reduce(s, { type: "continue", at: AT });
    const html = screen(engine, s);
    expect(html).toContain("65/20 civics practice");
    expect(html).toContain("Correct answers needed: 6.");
    expect(html).toContain("You have answered every question for this practice test.");
  });
});
