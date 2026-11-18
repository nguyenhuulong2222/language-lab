/**
 * Server-rendered checks of the shared practice components: voice states, spoken prompts,
 * the sentence diff and the take header. (No DOM is available in the test environment, so
 * interaction is covered by the engine tests; these check what each state shows.)
 */
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { AnswerInput } from "../components/AnswerInput";
import { SentenceDiff } from "../components/SentenceDiff";
import { SpeakButton } from "../components/SpeakButton";
import { TakeHeader } from "../components/TakeHeader";
import { VoiceProvider } from "../voice/VoiceProvider";
import type { PromptSpeaker } from "../voice/prompt-speaker";
import type { SpeechListener } from "../voice/speech-listener";
import { createDeviceVoiceSpeaker, SILENT_SPEAKER } from "../voice/prompt-speaker";
import { createBrowserSpeechListener, UNSUPPORTED_LISTENER } from "../voice/speech-listener";
import { compareSentence } from "../../engine/sentence-compare";

const workingListener: SpeechListener = { supported: true, listen: () => Promise.resolve({ kind: "nothing-heard" }), stop: () => {} };
const deviceSpeaker: PromptSpeaker = { kind: "device-voice", available: true, speak: () => Promise.resolve(), cancel: () => {} };

describe("AnswerInput", () => {
  const input = (voice: boolean, listener: SpeechListener, extra = {}) =>
    renderToString(
      <VoiceProvider listener={listener} speaker={SILENT_SPEAKER}>
        <AnswerInput label="Your answer" submitLabel="Send" voice={voice} onSubmit={() => {}} {...extra} />
      </VoiceProvider>
    );

  it("always has a labelled text box and a send button", () => {
    for (const html of [input(true, workingListener), input(true, UNSUPPORTED_LISTENER), input(false, workingListener)]) {
      expect(html).toContain("<textarea");
      expect(html).toContain("Your answer");
      expect(html).toContain("Send");
      expect(html).toContain('aria-live="polite"');
    }
  });

  it("offers Say it when the browser can listen", () => {
    expect(input(true, workingListener)).toContain("Say it");
  });

  it("says so, and hides Say it, when the browser cannot listen", () => {
    const html = input(true, UNSUPPORTED_LISTENER);
    expect(html).not.toContain("Say it");
    expect(html).toContain("This browser cannot listen to your voice. Type your answer instead.");
  });

  it("does not offer voice on a typed-only step", () => {
    const html = input(false, workingListener);
    expect(html).not.toContain("Say it");
    expect(html).not.toContain("cannot listen");
  });

  it("keeps the send button usable: an empty send explains itself instead of being disabled", () => {
    const html = input(true, workingListener);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Send/);
  });

  it("offers Skip only when asked", () => {
    expect(input(true, workingListener)).not.toContain("Skip this one");
    expect(input(true, workingListener, { allowSkip: true })).toContain("Skip this one");
  });
});

describe("voice adapters without a browser", () => {
  it("report themselves as unavailable instead of throwing", async () => {
    expect(createBrowserSpeechListener(undefined).supported).toBe(false);
    expect(await createBrowserSpeechListener(undefined).listen()).toEqual({ kind: "unsupported" });
    expect(createDeviceVoiceSpeaker(undefined).available).toBe(false);
  });

  it("a browser speech listener maps a refused microphone to denied", async () => {
    class Denied {
      lang = "";
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onresult: unknown = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        queueMicrotask(() => {
          this.onerror?.({ error: "not-allowed" });
          this.onend?.();
        });
      }
      stop() {}
    }
    const listener = createBrowserSpeechListener({ SpeechRecognition: Denied as unknown as new () => SpeechRecognition });
    expect(await listener.listen()).toEqual({ kind: "denied" });
  });

  it("a browser speech listener with no words returns nothing-heard, with words a transcript", async () => {
    const make = (words: string[]) =>
      class Fake {
        lang = "";
        interimResults = false;
        continuous = false;
        maxAlternatives = 1;
        onresult: ((e: unknown) => void) | null = null;
        onerror: unknown = null;
        onend: (() => void) | null = null;
        start() {
          queueMicrotask(() => {
            if (words.length > 0) {
              this.onresult?.({ resultIndex: 0, results: words.map((w) => [{ transcript: w }]) });
            }
            this.onend?.();
          });
        }
        stop() {}
      } as unknown as new () => SpeechRecognition;
    expect(await createBrowserSpeechListener({ SpeechRecognition: make([]) }).listen()).toEqual({ kind: "nothing-heard" });
    expect(await createBrowserSpeechListener({ SpeechRecognition: make(["we pay", "taxes"]) }).listen()).toEqual({
      kind: "transcript",
      text: "we pay taxes",
    });
  });
});

describe("SpeakButton", () => {
  it("offers Play aloud and labels the voice as the device voice", () => {
    const html = renderToString(
      <VoiceProvider speaker={deviceSpeaker} listener={UNSUPPORTED_LISTENER}>
        <SpeakButton text="Who was George Washington?" />
      </VoiceProvider>
    );
    expect(html).toContain("Play aloud");
    expect(html).toContain("Device voice");
    expect(html).not.toMatch(/<button[^>]*disabled/);
  });

  it("says when the browser cannot read aloud", () => {
    const html = renderToString(<SpeakButton text="Hello" />);
    expect(html).not.toContain("Play aloud");
    expect(html).toContain("This browser cannot read aloud");
  });
});

describe("SentenceDiff", () => {
  it("labels missing and extra words in text, not only by style", () => {
    const html = renderToString(<SentenceDiff diff={compareSentence("we pay taxes", "we really taxes", 0.8).diff} />);
    expect(html).toContain("missing");
    expect(html).toContain("extra");
    expect(html).toContain("Dashed words are missing");
    expect(html).toContain("diff__word--missing");
  });
});

describe("TakeHeader", () => {
  it("shows the take counter with the stage name and the title as H1", () => {
    const html = renderToString(<TakeHeader stage="reading" title="Reading" lead="Read it." />);
    expect(html).toContain("TAKE");
    expect(html).toContain("03");
    expect(html).toContain("<h1");
    expect(html).toContain("Read it.");
  });
});
