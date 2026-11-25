/**
 * Audit A11Y-02 to A11Y-07, as far as server rendering can show them. Focus moves and keyboard
 * handling need a browser; tools/layout-check drives those screens in Chrome.
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import headerSource from "../components/Header.tsx?raw";
import backToHomeSource from "../components/BackToHome.tsx?raw";
import answerInputSource from "../components/AnswerInput.tsx?raw";
import scriptsCss from "../styles/scripts.css?raw";
import { AnswerInput } from "../components/AnswerInput";
import { LanguageMenu } from "../components/LanguageMenu";
import { Disclaimer } from "../components/Disclaimer";
import { StudyScreen } from "../screens/StudyScreen";
import { IntroScreen } from "../screens/IntroScreen";
import { loadAnswerKey } from "../../engine/civics-answer-key";
import { createDefaultPracticeEnv } from "../../engine/practice-flow";
import { loadCivicsBoundaryDate } from "../../engine/test-rules-loader";
import type { PictureEntry } from "../../engine/question-images";
const noop = () => {};
describe("A11Y-02 and A11Y-03: header panels", () => {
  it("Leave closes the question before going home", () => {
    expect(backToHomeSource).toMatch(/setConfirmOpen\(false\);\s*onHome\(\);/);
  });
  it("an opened panel can take focus", () => {
    expect(headerSource).toContain("tabIndex={-1}");
  });
  it("the language menu is one tab stop (roving tabindex)", () => {
    const html = renderToString(<LanguageMenu open onChoose={noop} />);
    expect(html.match(/tabindex="0"/g)?.length).toBe(1);
    expect((html.match(/tabindex="-1"/g)?.length ?? 0)).toBeGreaterThan(0);
  });
});
describe("A11Y-04: error states", () => {
  it("the answer box is English text and is not marked invalid before anything happens", () => {
    const html = renderToString(<AnswerInput label="Your answer" submitLabel="Check" voice={false} onSubmit={noop} />);
    expect(html).toMatch(/<textarea[^>]*lang="en"/);
    expect(html).not.toContain("aria-invalid");
  });
});
describe("A11Y-05: Study first order", () => {
  const PICTURE: PictureEntry = { id: "p", file: "/images/civics/p.webp", width: 10, height: 10, alt: "A picture", caption: "Caption text", credit: "c", questionIds: [] } as unknown as PictureEntry;
  it("the picture comes after the question, and the count is not a live region", () => {
    const keys = { "2008": loadAnswerKey("2008"), "2025": loadAnswerKey("2025") };
    const html = renderToString(
      <StudyScreen answerKey={(v) => ({ status: "ready", key: keys[v] })} onHome={noop} initialVersion="2008" pictureFor={() => PICTURE} />
    );
    expect(html.indexOf("What is the supreme law of the land?")).toBeLessThan(html.indexOf("<img"));
    expect(html).not.toMatch(/class="progress-line" role="status"/);
  });
});
describe("A11Y-06: English text is marked lang=en", () => {
  it("a disclaimer given as text (the report one, from the engine)", () => {
    expect(renderToString(<Disclaimer text="This is a practice tool only." />)).toContain('<span lang="en">This is a practice tool only.</span>');
  });
  it("the fictional profile names on the setup screen", () => {
    const env = createDefaultPracticeEnv();
    const html = renderToString(
      <IntroScreen profiles={env.content.profiles} boundaryDate={loadCivicsBoundaryDate()} needs={{ profile: true, filing: false }} onStart={noop} />
    );
    expect(html).toContain(`<span lang="en">${env.content.profiles[0]!.displayName}</span>`);
  });
});
describe("A11Y-07: mono lines in scripts without a monospace face", () => {
  it("use the body font of the script", () => {
    expect(scriptsCss).toMatch(/\.take__overline, \.progress-line, \.stepper__condensed-count, \.report__overline\) \{\s*font-family: var\(--font-body\);/);
    for (const code of ["th", "lo", "my", "hi", "ko"]) expect(scriptsCss).toContain(`[lang="${code}"]`);
  });
});

describe("the one-time voice notice", () => {
  it("only Continue records that the notice was seen; Type instead does not", () => {
    const typeInstead = /const typeInstead = \(\) => \{([\s\S]*?)\n  \};/.exec(answerInputSource)?.[1] ?? "";
    const continueWithVoice = /const continueWithVoice = \(\) => \{([\s\S]*?)\n  \};/.exec(answerInputSource)?.[1] ?? "";
    expect(continueWithVoice).toContain("seen.add(VOICE_NOTICE_KEY)");
    expect(typeInstead).not.toBe("");
    expect(typeInstead).not.toContain("seen.add");
  });
});
describe("the page frame keeps its styles", () => {
  it("Shell imports App.css (the skip link is hidden until focused, the column is centred)", async () => {
    const shell = (await import("../components/Shell.tsx?raw")).default;
    expect(shell).toContain('import "../App.css";');
  });
});
