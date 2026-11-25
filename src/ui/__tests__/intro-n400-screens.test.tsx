import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { HomeScreen } from "../screens/HomeScreen";
import { IntroScreen } from "../screens/IntroScreen";
import { N400View } from "../screens/N400Screen";
import { loadPracticeContent } from "../../engine/practice-content";
import { loadCivicsBoundaryDate } from "../../engine/test-rules-loader";

const content = loadPracticeContent();
const profile = content.profiles[0]!;
const question = content.n400Questions[0]!;

describe("HomeScreen", () => {
  const html = renderToString(<HomeScreen civicsLocked={false} onChoose={() => {}} />);

  it("offers the full interview and each single part", () => {
    expect(html).toContain("Practice test");
    expect(html).toContain("Or practice one part");
    for (const part of ["N-400 interview", "Reading", "Writing", "Civics"]) expect(html).toContain(part);
  });

  it("explains how it works in three steps", () => {
    expect(html).toContain("How it works");
    expect(html).toContain("Listen");
    expect(html).toContain("Speak or type");
    expect(html).toContain("See the result");
    expect(html).toContain("Typing always works.");
  });

  it("shows the disclaimers and says how voice is processed", () => {
    expect(html).toContain("Please read this");
    expect(html).toContain("This is a practice tool only.");
    expect(html).toContain("It is not legal advice.");
    expect(html).toContain("not a government service");
    expect(html).toContain("does not send or save your voice");
    expect(html).toContain("the recording stays on this device, in memory");
  });

  it("asks for nothing on the home screen", () => {
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain('type="radio"');
    expect(html).not.toContain('type="text"');
  });

  it("while civics is locked, offers only what works: no full interview, no Study first, no civics card", () => {
    const locked = renderToString(<HomeScreen civicsLocked onChoose={() => {}} onStudy={() => {}} />);
    expect(locked).not.toContain("Practice test");
    expect(locked).not.toContain("Look through the civics questions");
    expect(locked).not.toContain("Answer civics questions");
    for (const part of ["N-400 interview", "Reading", "Writing"]) expect(locked).toContain(part);
    // The notice comes before the cards.
    expect(locked.indexOf("Right now you can practice")).toBeLessThan(locked.indexOf("N-400 interview"));
  });
  it("explains a build that cannot score civics", () => {
    const locked = renderToString(<HomeScreen civicsLocked onChoose={() => {}} />);
    expect(locked).toContain("Right now you can practice");
    expect(locked).toContain("You can practice the N-400 interview, reading and writing.");
    expect(html).not.toContain("Right now you can practice");
  });
});

describe("IntroScreen (setup)", () => {
  const boundary = loadCivicsBoundaryDate();
  const render = (needs: { profile: boolean; filing: boolean }) =>
    renderToString(<IntroScreen profiles={content.profiles} boundaryDate={boundary} needs={needs} onStart={() => {}} />);

  it("a full interview asks for a profile and the filing choice", () => {
    const html = render({ profile: true, filing: true });
    for (const p of content.profiles) expect(html).toContain(p.displayName);
    expect((html.match(/type="radio"/g) ?? []).length).toBe(content.profiles.length + 2);
    expect(html).toContain("Choose a practice person");
    expect(html).toContain("Practice as if the N-400 was filed");
    expect(html).toContain("Before October 20, 2025");
    expect(html).toContain("On or after October 20, 2025");
    expect(html).toContain("check uscis.gov to see which test applies to you");
    expect(html).toContain("Fictional practice profile");
  });

  it("the N-400 part asks only for a profile", () => {
    const html = render({ profile: true, filing: false });
    expect(html).toContain("Choose a practice person");
    expect(html).not.toContain("Practice as if the N-400 was filed");
    expect(html).toContain("Do not say your real name, address, date of birth or A-number");
  });

  it("the civics part asks only for the filing choice", () => {
    const html = render({ profile: false, filing: true });
    expect(html).not.toContain("Choose a practice person");
    expect(html).toContain("Practice as if the N-400 was filed");
    expect(html).not.toContain("A-number");
    expect((html.match(/type="radio"/g) ?? []).length).toBe(2);
  });

  it("never offers a date or free text field", () => {
    const html = render({ profile: true, filing: true });
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain('type="text"');
    expect(html).not.toContain("<textarea");
  });

  it("starts disabled until the needed choices are made", () => {
    const html = render({ profile: true, filing: true });
    // aria-disabled, not disabled: the button stays focusable and its hint can be read.
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Start practice/);
    expect(html).not.toMatch(/<button[^>]*\sdisabled[^>]*>Start practice/);
    expect(html).toContain("Choose one answer in each group above. Then press “Start practice”.");
  });
});

describe("N400View", () => {
  const base = { profile, answers: [], total: content.n400Questions.length, onAnswer: () => {}, onFinish: () => {} };

  it("shows the question, the fictional sample answer and an answer box", () => {
    const html = renderToString(
      <N400View {...base} state={{ status: "ready", prompt: { id: question.id, text: question.text, sampleAnswer: question.sampleAnswers[profile.id]! } }} />
    );
    expect(html).toContain(question.text);
    expect(html).toContain(question.sampleAnswers[profile.id]!);
    expect(html).toContain(`Sample answer for ${profile.displayName} (fictional)`);
    expect(html).toContain("you must answer truthfully about your own life");
    expect(html).toContain("Practice uses the fictional profile");
    expect(html).toContain("This part gets no score.");
    expect(html).toContain("<textarea");
    expect(html).toContain(`Question 1 of ${content.n400Questions.length}`);
  });

  it("works with a coach that has no sample answer", () => {
    const html = renderToString(<N400View {...base} state={{ status: "ready", prompt: { id: "x", text: "Another question?", sampleAnswer: null } }} />);
    expect(html).not.toContain("Sample answer");
    expect(html).toContain("Another question?");
  });

  it("shows loading and failure states", () => {
    expect(renderToString(<N400View {...base} state={{ status: "loading" }} />)).toContain("Getting the next question");
    expect(renderToString(<N400View {...base} state={{ status: "failed" }} />)).toContain("did not load");
  });

  it("at the end shows the user's own words and a way to go on", () => {
    const html = renderToString(
      <N400View
        {...base}
        answers={[{ questionId: question.id, questionText: question.text, transcript: "my own words" }]}
        state={{ status: "done" }}
      />
    );
    expect(html).toContain("my own words");
    expect(html).toContain("Go to reading");
    expect(html).toContain("not scored");
  });
});
