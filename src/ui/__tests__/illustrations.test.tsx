/**
 * AI illustrations in the UI: shown only when reviewed, only after grading and in Study, never in
 * the question view, always with the visible "AI-generated illustration" label, after a federal
 * photo never, and listed in the credits with their model.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import civicsScreenSource from "../screens/CivicsScreen.tsx?raw";
import { loadAnswerKey } from "../../engine/civics-answer-key";
import type { IllustrationEntry } from "../../engine/illustrations";
import { createDefaultPracticeEnv, createPracticeEngine, type AnswerKeyResult, type PracticeState } from "../../engine/practice-flow";
import type { PictureEntry } from "../../engine/question-images";
import type { CivicsTestVersion } from "../../engine/version-selector";
import { isLegalKey } from "../../i18n";
import { I18nProvider } from "../../i18n/react";
import { QuestionIllustration } from "../components/QuestionPicture";
import { CivicsScreen } from "../screens/CivicsScreen";
import { CreditsScreen } from "../screens/CreditsScreen";
import { StudyScreen } from "../screens/StudyScreen";
const AT = "2026-11-26T10:00:00.000Z";
const LABEL = "AI-generated illustration";
const ILLUSTRATION: IllustrationEntry = {
  id: "test-illustration",
  file: "test-illustration.webp",
  questions: ["2008-001"],
  model: "gpt-image-test-model",
  prompt: "A test prompt.",
  date: "2026-11-26",
  sha256: "c".repeat(64),
  alt: "Alt text of the test illustration",
  caption: "Caption of the test illustration",
  source: "ai",
  reviewed: true,
  width: 1024,
  height: 1024,
  bytes: 80000,
};
const UNREVIEWED: IllustrationEntry = { ...ILLUSTRATION, reviewed: false, caption: "Unreviewed caption", alt: "Unreviewed alt" };
const PHOTO: PictureEntry = {
  id: "test-photo",
  file: "test-photo.webp",
  title: "A photo title",
  creator: "A. Creator",
  date: "1901",
  sourcePageUrl: "https://www.loc.gov/item/1/",
  fileUrl: "https://tile.loc.gov/x/1v.jpg",
  rights: "No known restrictions on publication.",
  downloadedOn: "2026-11-18",
  sha256: "a".repeat(64),
  alt: "Alt text of the photo",
  caption: "Caption of the photo",
  width: 800,
  height: 600,
  bytes: 90000,
};
const always = () => ILLUSTRATION;
const unreviewed = () => UNREVIEWED;
const noPhoto = () => null;
function quiet(version: CivicsTestVersion): AnswerKeyResult {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return { status: "ready", key: loadAnswerKey(version, { production: false }) };
  } finally {
    warn.mockRestore();
  }
}
const keys = { "2008": quiet("2008"), "2025": quiet("2025") };
const base = createDefaultPracticeEnv();
const engine = createPracticeEngine({ ...base, answerKey: (v) => keys[v] });
const profile = base.content.profiles[0]!.id;
const noop = () => {};
function toCivics(): PracticeState {
  let s = engine.reduce(engine.initial(), { type: "choose", mode: "civics", seed: 5, at: AT });
  s = engine.reduce(s, { type: "start", profileId: profile, filedOn: "before", seed: 5, at: AT });
  return s;
}
function answered(response: string) {
  return engine.civicsProgress(engine.reduce(toCivics(), { type: "submitCivics", response, input: "typed", at: AT }));
}
describe("the AI label", () => {
  it("is always shown with a reviewed illustration, with the alt text and caption", () => {
    const html = renderToString(<QuestionIllustration illustration={ILLUSTRATION} />);
    expect(html).toContain(LABEL);
    expect(html).toContain(`alt="${ILLUSTRATION.alt}"`);
    expect(html).toContain(ILLUSTRATION.caption);
    expect(html.indexOf(LABEL)).toBeGreaterThan(html.indexOf("<figcaption"));
  });
  it("is a legal line, so it stays in English in a language without a reviewer", () => {
    expect(isLegalKey("illustration.label")).toBe(true);
    const html = renderToString(
      <I18nProvider language="vi">
        <QuestionIllustration illustration={ILLUSTRATION} />
      </I18nProvider>
    );
    expect(html).toContain(LABEL);
  });
});
describe("an unreviewed illustration", () => {
  it("never renders, even when handed to the component directly", () => {
    expect(renderToString(<QuestionIllustration illustration={UNREVIEWED} />)).toBe("");
  });
  it("never renders after grading or in Study", () => {
    const civics = renderToString(
      <CivicsScreen progress={answered("x")} version="2008" onSubmit={noop} onContinue={noop} onRestart={noop} showFeedbackInitially pictureFor={noPhoto} illustrationFor={unreviewed} />
    );
    const study = renderToString(<StudyScreen answerKey={(v) => keys[v]} onHome={noop} initialVersion="2008" pictureFor={noPhoto} illustrationFor={unreviewed} />);
    for (const html of [civics, study]) {
      expect(html).not.toContain("<img");
      expect(html).not.toContain(LABEL);
      expect(html).not.toContain(UNREVIEWED.caption);
    }
  });
});
describe("a reviewed illustration", () => {
  it("is not shown in the question view", () => {
    const progress = engine.civicsProgress(toCivics());
    const html = renderToString(
      <CivicsScreen progress={progress} version="2008" onSubmit={noop} onContinue={noop} onRestart={noop} pictureFor={noPhoto} illustrationFor={always} />
    );
    expect(html).toContain("<textarea");
    expect(html).not.toContain("<img");
    expect(html).not.toContain(LABEL);
  });
  it("is shown after grading, with the label", () => {
    const html = renderToString(
      <CivicsScreen progress={answered("x")} version="2008" onSubmit={noop} onContinue={noop} onRestart={noop} showFeedbackInitially pictureFor={noPhoto} illustrationFor={always} />
    );
    expect(html).toContain(`alt="${ILLUSTRATION.alt}"`);
    expect(html).toContain(LABEL);
  });
  it("is shown in Study, with the label", () => {
    const html = renderToString(<StudyScreen answerKey={(v) => keys[v]} onHome={noop} initialVersion="2008" pictureFor={noPhoto} illustrationFor={always} />);
    expect(html).toContain(`alt="${ILLUSTRATION.alt}"`);
    expect(html).toContain(LABEL);
  });
  it("gives way to a federal photo when the question has one", () => {
    const civics = renderToString(
      <CivicsScreen progress={answered("x")} version="2008" onSubmit={noop} onContinue={noop} onRestart={noop} showFeedbackInitially pictureFor={() => PHOTO} illustrationFor={always} />
    );
    const study = renderToString(<StudyScreen answerKey={(v) => keys[v]} onHome={noop} initialVersion="2008" pictureFor={() => PHOTO} illustrationFor={always} />);
    for (const html of [civics, study]) {
      expect(html).toContain(PHOTO.caption);
      expect(html).not.toContain(LABEL);
    }
  });
  it("only the feedback branch of CivicsScreen uses QuestionIllustration (source check)", () => {
    const uses = [...civicsScreenSource.matchAll(/<QuestionIllustration/g)].map((m) => m.index ?? -1);
    expect(uses).toHaveLength(1);
    const feedbackStart = civicsScreenSource.indexOf("if (feedback && progress.last !== null && progress.result !== null)");
    const questionView = civicsScreenSource.indexOf("const question = progress.current;");
    expect(uses[0]!).toBeGreaterThan(feedbackStart);
    expect(uses[0]!).toBeLessThan(questionView);
  });
});
describe("only two places render an illustration", () => {
  const sources = import.meta.glob(["../**/*.tsx", "!../__tests__/**"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  it("QuestionIllustration is used by CivicsScreen and StudyScreen only", () => {
    const users = Object.entries(sources)
      .filter(([file, text]) => /<QuestionIllustration/.test(text) && !file.endsWith("QuestionPicture.tsx"))
      .map(([file]) => file.split("/").pop())
      .sort();
    expect(users).toEqual(["CivicsScreen.tsx", "StudyScreen.tsx"]);
  });
});
describe("the credits", () => {
  it("list reviewed illustrations under their own heading, with the model", () => {
    const html = renderToString(<CreditsScreen onClose={noop} manifest={{ images: [] }} illustrations={{ images: [ILLUSTRATION] }} />);
    expect(html).toContain("AI-generated illustrations");
    expect(html).toContain(ILLUSTRATION.caption);
    expect(html).toContain(ILLUSTRATION.model);
  });
  it("leave out unreviewed illustrations, and the heading when none is reviewed", () => {
    const html = renderToString(<CreditsScreen onClose={noop} manifest={{ images: [] }} illustrations={{ images: [UNREVIEWED] }} />);
    expect(html).not.toContain("AI-generated illustrations");
    expect(html).not.toContain(UNREVIEWED.caption);
  });
});
