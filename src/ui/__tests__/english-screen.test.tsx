import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { EnglishScreen } from "../screens/EnglishScreen";
import { VoiceProvider } from "../voice/VoiceProvider";
import { SILENT_SPEAKER, type PromptSpeaker } from "../voice/prompt-speaker";
import { UNSUPPORTED_LISTENER, type SpeechListener } from "../voice/speech-listener";
import {
  createDefaultPracticeEnv,
  createPracticeEngine,
  type PracticeState,
} from "../../engine/practice-flow";

const AT = "2026-11-17T10:00:00.000Z";
// The civics key is not needed here: use a refused key so no key is loaded.
const env = { ...createDefaultPracticeEnv(), answerKey: () => ({ status: "locked" as const, reason: "test" }) };
const engine = createPracticeEngine(env);
const profile = env.content.profiles[0]!.id;
const readingAccuracy = env.config.sentenceMatch.reading.minWordAccuracy;
const writingAccuracy = env.config.sentenceMatch.writing.minWordAccuracy;

const speaker: PromptSpeaker = { kind: "device-voice", available: true, speak: () => Promise.resolve(), cancel: () => {} };
const listener: SpeechListener = { supported: true, listen: () => Promise.resolve({ kind: "nothing-heard" }), stop: () => {} };

function atReading(): PracticeState {
  const s = engine.reduce(engine.initial(), { type: "start", profileId: profile, filedOn: "before", seed: 7, at: AT });
  return engine.reduce(s, { type: "finishN400" });
}

function render(state: PracticeState, kind: "reading" | "writing", opts: { feedback?: boolean; voice?: boolean } = {}) {
  const progress = engine.englishProgress(state, kind);
  return renderToString(
    <VoiceProvider speaker={opts.voice === false ? SILENT_SPEAKER : speaker} listener={opts.voice === false ? UNSUPPORTED_LISTENER : listener}>
      <EnglishScreen
        progress={progress}
        minWordAccuracy={kind === "reading" ? readingAccuracy : writingAccuracy}
        onSubmit={() => {}}
        onContinue={() => {}}
        showFeedbackInitially={opts.feedback}
      />
    </VoiceProvider>
  );
}

describe("reading screen", () => {
  it("shows the sentence, a voice button, a typed box and the practice setting", () => {
    const s = atReading();
    const html = render(s, "reading");
    const sentence = engine.englishProgress(s, "reading").current!;
    expect(html).toContain(sentence.text.replace("’", "&#x27;"));
    expect(html).toContain("Say it");
    expect(html).toContain("<textarea");
    expect(html).toContain("Skip this one");
    expect(html).toContain(`at least ${Math.round(readingAccuracy * 100)}% of the words must match`);
    expect(html).toContain("not a USCIS rule");
    expect(html).toContain("official USCIS reading and writing vocabulary lists");
    expect(html).toContain("Sentence 1 of");
  });

  it("without voice support still offers typing and says why", () => {
    const html = render(atReading(), "reading", { voice: false });
    expect(html).toContain("<textarea");
    expect(html).not.toContain("Say it");
    expect(html).toContain("cannot listen");
  });

  it("shows good feedback and the end of the stage after a correct reading", () => {
    let s = atReading();
    const current = engine.englishProgress(s, "reading").current!;
    s = engine.reduce(s, { type: "submitReading", transcript: current.text, input: "voice", at: AT });
    const html = render(s, "reading", { feedback: true });
    expect(html).toContain("Good: 100% of the words matched.");
    expect(html).toContain("You read a sentence correctly. Reading is done.");
    expect(html).toContain("Go to writing");
  });

  it("shows not-yet feedback with missing words marked, and the next sentence button", () => {
    let s = atReading();
    s = engine.reduce(s, { type: "submitReading", transcript: "zzz", input: "typed", at: AT });
    const progress = engine.englishProgress(s, "reading");
    const html = render(s, "reading", { feedback: true });
    expect(html).toContain("Not yet: 0% of the words matched.");
    expect(html).toContain("missing");
    expect(progress.done).toBe(false);
    expect(html).toContain("Next sentence");
    expect(html).not.toContain("Reading is done");
  });

  it("says the stage is over when the last sentence is not right", () => {
    let s = atReading();
    for (;;) {
      const p = engine.englishProgress(s, "reading");
      if (p.done) break;
      s = engine.reduce(s, { type: "submitReading", transcript: "zzz", input: "typed", at: AT });
    }
    const html = render(s, "reading", { feedback: true });
    expect(html).toContain("That was the last sentence. More practice will help.");
    expect(html).toContain("Go to writing");
  });
});

describe("writing screen", () => {
  function atWriting(): PracticeState {
    let s = atReading();
    for (;;) {
      const p = engine.englishProgress(s, "reading");
      if (p.done) break;
      s = engine.reduce(s, { type: "submitReading", transcript: p.current!.text, input: "typed", at: AT });
    }
    return engine.reduce(s, { type: "continue", at: AT });
  }

  it("with a voice, hides the sentence, offers play aloud and typing only", () => {
    const s = atWriting();
    const sentence = engine.englishProgress(s, "writing").current!;
    const html = render(s, "writing");
    expect(html).toContain("Play aloud");
    expect(html).toContain("The sentence stays hidden until you answer.");
    expect(html).not.toContain(sentence.text);
    expect(html).not.toContain("Say it");
    expect(html).toContain("<textarea");
    expect(html).toContain(`at least ${Math.round(writingAccuracy * 100)}% of the words must match`);
  });

  it("without a voice, shows the sentence so the step still works", () => {
    const s = atWriting();
    const sentence = engine.englishProgress(s, "writing").current!;
    const html = render(s, "writing", { voice: false });
    expect(html).toContain("This browser cannot read aloud, so the sentence is shown here.");
    expect(html).toContain(sentence.text.replace("’", "&#x27;").replace(/,/g, ","));
  });

  it("feedback says what was typed", () => {
    let s = atWriting();
    s = engine.reduce(s, { type: "submitWriting", transcript: "we pay", input: "typed", at: AT });
    const html = render(s, "writing", { feedback: true });
    expect(html).toContain("What you typed");
    expect(html).toContain("we pay");
  });
});
