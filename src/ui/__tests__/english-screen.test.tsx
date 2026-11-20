import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { EnglishScreen } from "../screens/EnglishScreen";
import { VoiceProvider } from "../voice/VoiceProvider";
import { SILENT_SPEAKER, type PromptSpeaker } from "../voice/prompt-speaker";
import { UNSUPPORTED_LISTENER, type SpeechListener } from "../voice/speech-listener";
import type { SelfReviewRecorder } from "../voice/self-review";
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

const RECORDER: SelfReviewRecorder = { supported: true, start: () => Promise.resolve({ kind: "recording" }), stop: () => Promise.resolve({ kind: "nothing" }), discard: () => {} };
const speaker: PromptSpeaker = {
  available: true,
  voiceFor: () => "device-voice",
  speak: () => Promise.resolve(),
  cancel: () => {},
};
const listener: SpeechListener = { supported: true, listen: () => Promise.resolve({ kind: "nothing-heard" }), stop: () => {} };

function atReading(): PracticeState {
  const chosen = engine.reduce(engine.initial(), { type: "choose", mode: "full", seed: 7, at: AT });
  const s = engine.reduce(chosen, { type: "start", profileId: profile, filedOn: "before", seed: 7, at: AT });
  return engine.reduce(s, { type: "finishN400", at: AT });
}

function render(state: PracticeState, kind: "reading" | "writing", opts: { feedback?: boolean; voice?: boolean; recorder?: SelfReviewRecorder } = {}) {
  const progress = engine.englishProgress(state, kind);
  return renderToString(
    <VoiceProvider
      speaker={opts.voice === false ? SILENT_SPEAKER : speaker}
      listener={opts.voice === false ? UNSUPPORTED_LISTENER : listener}
      {...(opts.recorder === undefined ? {} : { recorder: opts.recorder })}
    >
      <EnglishScreen
        progress={progress}
        matchOptions={engine.matchOptions(kind)}
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
    // The sentence is not played before the attempt.
    expect(html).not.toContain("Play aloud");
    expect(html).toContain("every important word of the sentence must be there, in order");
    expect(html).toContain("not a USCIS rule");
    expect(html).toContain("official USCIS reading and writing vocabulary lists");
    expect(html).toContain("Sentence 1 of");
  });

  it("without voice support still offers typing and says why", () => {
    const html = render(atReading(), "reading", { voice: false });
    expect(html).toContain("<textarea");
    expect(html).not.toContain(">Say it<");
    expect(html).toContain("cannot listen");
  });

  it("shows good feedback and the end of the stage after a correct reading", () => {
    let s = atReading();
    const current = engine.englishProgress(s, "reading").current!;
    s = engine.reduce(s, { type: "submitReading", transcript: current.text, input: "voice", at: AT });
    const html = render(s, "reading", { feedback: true });
    expect(html).toContain("This counts.");
    expect(html).toContain("You read a sentence correctly. Reading is done.");
    expect(html).toContain("Go to writing");
  });

  it("shows not-yet feedback with missing words marked, and the next sentence button", () => {
    let s = atReading();
    s = engine.reduce(s, { type: "submitReading", transcript: "zzz", input: "typed", at: AT });
    const progress = engine.englishProgress(s, "reading");
    const html = render(s, "reading", { feedback: true });
    expect(html).toContain("Not yet.");
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
    expect(html).toContain("every important word of the sentence must be there, in order");
  });

  it("with a voice, offers a clearly labelled Show the sentence button and explains it", () => {
    const html = render(atWriting(), "writing");
    expect(html).toContain("Show the sentence");
    expect(html).toContain("Your report marks this attempt as assisted.");
  });
  it("without a voice, shows the sentence, says it is assisted and offers no button for it", () => {
    const html = render(atWriting(), "writing", { voice: false });
    expect(html).toContain("Your report marks this attempt as assisted.");
    expect(html).not.toContain("Show the sentence");
  });
  it("reading never offers Show the sentence", () => {
    expect(render(atReading(), "reading")).not.toContain("Show the sentence");
  });
  it("without a voice, shows the sentence so the step still works", () => {
    const s = atWriting();
    const sentence = engine.englishProgress(s, "writing").current!;
    const html = render(s, "writing", { voice: false });
    expect(html).toContain("This browser cannot read aloud, so the sentence is shown here.");
    expect(html).toContain(sentence.text.replace("’", "&#x27;").replace(/,/g, ","));
  });

  it("feedback marks an assisted attempt and says nothing about an unassisted one", () => {
    let s = atWriting();
    s = engine.reduce(s, { type: "submitWriting", transcript: "we pay", input: "typed", assisted: true, at: AT });
    expect(render(s, "writing", { feedback: true })).toContain("The sentence was shown on screen (assisted attempt).");
    let plain = atWriting();
    plain = engine.reduce(plain, { type: "submitWriting", transcript: "we pay", input: "typed", at: AT });
    expect(render(plain, "writing", { feedback: true })).not.toContain("assisted attempt");
  });
  it("feedback says what was typed", () => {
    let s = atWriting();
    s = engine.reduce(s, { type: "submitWriting", transcript: "we pay", input: "typed", at: AT });
    const html = render(s, "writing", { feedback: true });
    expect(html).toContain("What you typed");
    expect(html).toContain("we pay");
  });
});

describe("listen and compare on the reading screen", () => {
  it("before the first attempt it offers Record and compare and never the sample", () => {
    const html = render(atReading(), "reading", { recorder: RECORDER });
    expect(html).toContain("Listen and compare");
    expect(html).toContain("Record and compare");
    expect(html).toContain("Say it");
    expect(html).not.toContain("Hear the sample");
    expect(html).not.toContain("Play aloud");
    expect(html).toContain("stays on this device");
  });
  it("the sample is not offered before the first attempt even when the browser cannot record", () => {
    const html = render(atReading(), "reading");
    expect(html).not.toContain("Hear the sample");
  });
  it("after a checked attempt it offers the sample and Try again", () => {
    let s = atReading();
    s = engine.reduce(s, { type: "submitReading", transcript: "zzz", input: "typed", at: AT });
    const html = render(s, "reading", { feedback: true, recorder: RECORDER });
    expect(html).toContain("Hear the sample");
    expect(html).toContain("Try again");
  });
  it("writing has no recording and no sample button", () => {
    let s = atReading();
    for (;;) {
      const p = engine.englishProgress(s, "reading");
      if (p.done) break;
      s = engine.reduce(s, { type: "submitReading", transcript: p.current!.text, input: "typed", at: AT });
    }
    const html = render(engine.reduce(s, { type: "continue", at: AT }), "writing", { recorder: RECORDER });
    expect(html).not.toContain(">Record and compare<");
    expect(html).not.toContain("Hear the sample");
  });
});
describe("try the sentence again", () => {
  it("replaces the last attempt: the sentence is asked again and only the new attempt counts", () => {
    let s = atReading();
    const first = engine.englishProgress(s, "reading").current!;
    s = engine.reduce(s, { type: "submitReading", transcript: "zzz", input: "typed", at: AT });
    expect(engine.englishProgress(s, "reading").current?.id).not.toBe(first.id);
    s = engine.reduce(s, { type: "retryEnglish" });
    expect(s.reading).toHaveLength(0);
    expect(engine.englishProgress(s, "reading").current?.id).toBe(first.id);
    s = engine.reduce(s, { type: "submitReading", transcript: first.text, input: "typed", at: AT });
    expect(s.reading).toHaveLength(1);
    expect(s.reading[0]!.isCorrect).toBe(true);
  });
  it("does nothing when there is no attempt, or outside reading and writing", () => {
    const s = atReading();
    expect(engine.reduce(s, { type: "retryEnglish" })).toBe(s);
    const home = engine.initial();
    expect(engine.reduce(home, { type: "retryEnglish" })).toBe(home);
  });
  it("a spoken attempt scores every alternative and keeps the best one as what we heard", () => {
    let s = atReading();
    const sentence = engine.englishProgress(s, "reading").current!;
    s = engine.reduce(s, { type: "submitReading", transcript: "zzz qqq", alternatives: ["zzz", sentence.text.toLowerCase()], input: "voice", at: AT });
    const attempt = s.reading[0]!;
    expect(attempt.alternativesScored).toBe(3);
    expect(attempt.usedAlternative).toBe(2);
    expect(attempt.transcript).toBe(sentence.text.toLowerCase());
    expect(attempt.isCorrect).toBe(true);
  });
  it("typed text is scored as typed: no alternatives", () => {
    let s = atReading();
    s = engine.reduce(s, { type: "submitReading", transcript: "zzz", input: "typed", at: AT });
    expect(s.reading[0]).toMatchObject({ alternativesScored: 1, usedAlternative: 0, isCorrect: false });
  });
});
