/**
 * Pictures (BS-20, BS-21): never shown before or during an answer, shown after grading, shown in
 * Study first, and credited. The question view is rendered with a picture available for every
 * question: it must still show none.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import civicsScreenSource from "../screens/CivicsScreen.tsx?raw";
import { loadAnswerKey } from "../../engine/civics-answer-key";
import {
  createDefaultPracticeEnv,
  createPracticeEngine,
  type AnswerKeyResult,
  type PracticeState,
} from "../../engine/practice-flow";
import type { PictureEntry } from "../../engine/question-images";
import type { CivicsTestVersion } from "../../engine/version-selector";
import { CivicsScreen } from "../screens/CivicsScreen";
import { CreditsScreen } from "../screens/CreditsScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { StudyScreen } from "../screens/StudyScreen";
import { Footer } from "../components/Footer";
import { PracticeApp } from "../PracticeApp";

const AT = "2026-11-17T10:00:00.000Z";
const PICTURE: PictureEntry = {
  id: "test-picture",
  file: "test-picture.webp",
  title: "A test title",
  creator: "A. Creator",
  date: "1901",
  sourcePageUrl: "https://www.loc.gov/item/1/",
  fileUrl: "https://tile.loc.gov/x/1v.jpg",
  rights: "No known restrictions on publication.",
  downloadedOn: "2026-11-18",
  sha256: "a".repeat(64),
  alt: "Alt text of the test picture",
  caption: "Caption of the test picture",
  width: 800,
  height: 600,
  bytes: 90000,
};
const always = () => PICTURE;

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

function toCivics(): PracticeState {
  const e = engine;
  let s = e.reduce(e.initial(), { type: "choose", mode: "civics", seed: 5, at: AT });
  s = e.reduce(s, { type: "start", profileId: profile, filedOn: "before", seed: 5, at: AT });
  return s;
}
const noop = () => {};

describe("the question view never shows a picture", () => {
  const s = toCivics();
  const progress = engine.civicsProgress(s);
  it("before the answer", () => {
    const html = renderToString(
      <CivicsScreen progress={progress} version="2008" onSubmit={noop} onContinue={noop} onRestart={noop} pictureFor={always} />
    );
    expect(html).toContain("<textarea");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<figure");
    expect(html).not.toContain("question-picture");
    expect(html).not.toContain(PICTURE.alt);
    expect(html).not.toContain(PICTURE.caption);
    expect(html).not.toContain(PICTURE.file);
  });
  it("even when asked to start in the feedback view before anything is graded", () => {
    const html = renderToString(
      <CivicsScreen progress={progress} version="2008" onSubmit={noop} onContinue={noop} onRestart={noop} showFeedbackInitially pictureFor={always} />
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain(PICTURE.caption);
  });
  it("only the feedback branch of CivicsScreen uses QuestionPicture (source check)", () => {
    const uses = [...civicsScreenSource.matchAll(/<QuestionPicture/g)].map((m) => m.index ?? -1);
    expect(uses).toHaveLength(1);
    const feedbackStart = civicsScreenSource.indexOf("if (feedback && progress.last !== null && progress.result !== null)");
    const questionView = civicsScreenSource.indexOf("const question = progress.current;");
    expect(feedbackStart).toBeGreaterThan(0);
    expect(uses[0]!).toBeGreaterThan(feedbackStart);
    expect(uses[0]!).toBeLessThan(questionView);
  });
});

describe("after grading", () => {
  const answered = (response: string) => {
    let s = toCivics();
    s = engine.reduce(s, { type: "submitCivics", response, input: "typed", at: AT });
    return engine.civicsProgress(s);
  };
  it("shows the picture, its caption and alt text, after the official answers", () => {
    const q = engine.civicsProgress(toCivics()).current!;
    const progress = answered(q.acceptedAnswers.slice(0, q.requiredAnswerCount).join(" and "));
    const html = renderToString(
      <CivicsScreen progress={progress} version="2008" onSubmit={noop} onContinue={noop} onRestart={noop} showFeedbackInitially pictureFor={always} />
    );
    expect(html).toContain("<img");
    expect(html).toContain(`alt="${PICTURE.alt}"`);
    expect(html).toContain(PICTURE.caption);
    expect(html.indexOf("Official answers")).toBeLessThan(html.indexOf("question-picture"));
  });
  it("also after a skipped answer (it is graded as not yet)", () => {
    const html = renderToString(
      <CivicsScreen progress={answered("")} version="2008" onSubmit={noop} onContinue={noop} onRestart={noop} showFeedbackInitially pictureFor={always} />
    );
    expect(html).toContain("<img");
  });
  it("shows nothing when the question has no picture", () => {
    const html = renderToString(
      <CivicsScreen progress={answered("x")} version="2008" onSubmit={noop} onContinue={noop} onRestart={noop} showFeedbackInitially pictureFor={() => null} />
    );
    expect(html).not.toContain("<img");
  });
});

describe("Study first", () => {
  it("offers both test versions and no scoring", () => {
    const html = renderToString(<StudyScreen answerKey={(v) => keys[v]} onHome={noop} />);
    expect(html).toContain("Study first");
    expect(html).toContain("2008 civics test");
    expect(html).toContain("2025 civics test");
    expect(html).not.toContain("<textarea");
  });
  it("shows the picture, the question, audio and the official answers, and no answer box", () => {
    const html = renderToString(<StudyScreen answerKey={(v) => keys[v]} onHome={noop} initialVersion="2008" pictureFor={always} />);
    expect(html).toContain("<img");
    expect(html).toContain(PICTURE.caption);
    expect(html).toContain("What is the supreme law of the land?");
    expect(html).toContain("Official answers");
    expect(html).toMatch(/Play aloud|cannot read aloud/);
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("Check my answer");
    expect(html).toContain("Next question");
  });
  it("leaves out the questions whose answers change", () => {
    const html = renderToString(<StudyScreen answerKey={(v) => keys[v]} onHome={noop} initialVersion="2008" />);
    const total = [...(keys["2008"].status === "ready" ? keys["2008"].key.values() : [])].filter((e) => e.answerType === "static").length;
    expect(html).toContain(`Question 1 of ${total}`);
  });
  it("is off while the answer key is locked", () => {
    const html = renderToString(
      <StudyScreen answerKey={() => ({ status: "locked", reason: "needsHumanReview" })} onHome={noop} initialVersion="2008" pictureFor={always} />
    );
    expect(html).toContain("switched off in this build");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("Official answers");
  });
  it("is reachable from the home screen and the practice app", () => {
    const home = renderToString(<HomeScreen civicsLocked={false} onChoose={noop} onStudy={noop} />);
    expect(home).toContain("Study first");
    expect(renderToString(<PracticeApp engine={engine} />)).toContain("Study first");
  });
});

describe("only two places render a picture", () => {
  const sources = import.meta.glob(["../**/*.tsx", "!../__tests__/**"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  it("QuestionPicture is used by CivicsScreen and StudyScreen only", () => {
    const users = Object.entries(sources)
      .filter(([file, text]) => /<QuestionPicture/.test(text) && !file.endsWith("QuestionPicture.tsx"))
      .map(([file]) => file.split("/").pop())
      .sort();
    expect(users).toEqual(["CivicsScreen.tsx", "StudyScreen.tsx"]);
  });
  it("no other source renders an img of a civics picture", () => {
    const withImg = Object.entries(sources)
      .filter(([, text]) => /<img\b/.test(text))
      .map(([file]) => file.split("/").pop())
      .sort();
    expect(withImg).toEqual(["QuestionPicture.tsx"]);
  });
});

describe("picture credits", () => {
  const manifest = { images: [PICTURE] };
  it("lists title, creator, source and the rights statement", () => {
    const html = renderToString(<CreditsScreen onClose={noop} manifest={manifest} />);
    expect(html).toContain("Picture credits");
    expect(html).toContain(PICTURE.title);
    expect(html).toContain(PICTURE.creator);
    expect(html).toContain(PICTURE.sourcePageUrl);
    expect(html).toContain(PICTURE.rights);
    expect(html).toContain("does not mean any agency endorses Language Lab");
  });
  it("is linked from the footer", () => {
    const html = renderToString(<Footer onCredits={noop} />);
    expect(html).toContain("Picture credits");
    expect(html).toContain("<button");
  });
});
