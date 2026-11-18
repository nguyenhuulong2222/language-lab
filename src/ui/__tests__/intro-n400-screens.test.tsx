import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { IntroScreen } from "../screens/IntroScreen";
import { N400View } from "../screens/N400Screen";
import { loadPracticeContent } from "../../engine/practice-content";
import { loadCivicsBoundaryDate } from "../../engine/test-rules-loader";

const content = loadPracticeContent();
const profile = content.profiles[0]!;
const question = content.n400Questions[0]!;

describe("IntroScreen", () => {
  const html = renderToString(
    <IntroScreen profiles={content.profiles} boundaryDate={loadCivicsBoundaryDate()} civicsLocked={false} onStart={() => {}} />
  );

  it("offers every fictional profile as a labelled radio, marked fictional", () => {
    for (const p of content.profiles) expect(html).toContain(p.displayName);
    expect((html.match(/type="radio"/g) ?? []).length).toBe(content.profiles.length + 2);
    expect(html).toContain("Fictional practice profile");
    expect(html).toContain("Choose a practice profile");
  });

  it("asks about the filing date with the boundary date from the rules, not a typed date", () => {
    expect(html).toContain("When was the N-400 filed?");
    expect(html).toContain("Before October 20, 2025");
    expect(html).toContain("On or after October 20, 2025");
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain('type="text"');
  });

  it("shows the disclaimers and the do-not-share note", () => {
    expect(html).toContain("This is a practice tool only.");
    expect(html).toContain("It is not legal advice.");
    expect(html).toContain("not a government service");
    expect(html).toContain("Do not say your real name, address, date of birth or A-number");
    expect(html).toContain("Please read this");
  });

  it("says how voice input is processed", () => {
    expect(html).toContain("does not record or send your voice");
  });

  it("starts disabled until both choices are made", () => {
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Start practice/);
    expect(html).toContain("Choose a profile and a filing date to start.");
  });

  it("explains a build that cannot score civics", () => {
    const locked = renderToString(
      <IntroScreen profiles={content.profiles} boundaryDate="2025-10-20" civicsLocked onStart={() => {}} />
    );
    expect(locked).toContain("Civics scoring is switched off in this build");
    expect(html).not.toContain("Civics scoring is switched off");
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
    expect(html).toContain("you answer truthfully about your own life");
    expect(html).toContain("Nothing in this step is scored");
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
    expect(renderToString(<N400View {...base} state={{ status: "failed" }} />)).toContain("could not be loaded");
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
