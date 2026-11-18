/**
 * The pre-generated MP3 player: clip lookup, fallback to the device voice, start inside the
 * tap (iPhone Safari), second tap stops, and the labels. A small fake stands in for the
 * browser's audio element.
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { emptyManifest, hashText, type AudioManifest } from "../../engine/audio-clips";
import { loadPracticeContent } from "../../engine/practice-content";
import { SpeakButton } from "../components/SpeakButton";
import { N400View } from "../screens/N400Screen";
import { createMp3PromptSpeaker, SLOW_PLAYBACK_RATE, type AudioLike, type PromptSpeaker, type SpokenPrompt } from "../voice/prompt-speaker";
import { VoiceProvider } from "../voice/VoiceProvider";
import { UNSUPPORTED_LISTENER } from "../voice/speech-listener";

class FakeAudio implements AudioLike {
  src = "";
  currentTime = 0;
  playbackRate = 1;
  preservesPitch: boolean | undefined;
  plays: string[] = [];
  pauses = 0;
  failPlay = false;
  private listeners = new Map<string, Set<() => void>>();
  play() {
    this.plays.push(this.src);
    return this.failPlay ? Promise.reject(new Error("blocked")) : Promise.resolve();
  }
  pause() {
    this.pauses++;
  }
  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }
  fire(type: "ended" | "error") {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }
  count(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeFallback implements PromptSpeaker {
  available: boolean;
  spoken: SpokenPrompt[] = [];
  cancels = 0;
  constructor(available = true) {
    this.available = available;
  }
  voiceFor() {
    return this.available ? ("device-voice" as const) : null;
  }
  speak(prompt: SpokenPrompt) {
    this.spoken.push(prompt);
    return Promise.resolve();
  }
  cancel() {
    this.cancels++;
  }
}

const TEXT = "What is the supreme law of the land?";
const manifest: AudioManifest = {
  ...emptyManifest(),
  clips: { "civics-2008-001": { file: "civics/2008-001.mp3", hash: hashText(TEXT), group: "civics-2008" } },
};
const prompt: SpokenPrompt = { text: TEXT, clipId: "civics-2008-001" };

function setup(options: { audio?: FakeAudio | null; fallback?: FakeFallback; manifest?: AudioManifest } = {}) {
  const audio = options.audio === undefined ? new FakeAudio() : options.audio;
  const fallback = options.fallback ?? new FakeFallback();
  let created = 0;
  const speaker = createMp3PromptSpeaker({
    manifest: options.manifest ?? manifest,
    fallback,
    createAudio: () => {
      created++;
      return audio;
    },
  });
  return { audio, fallback, speaker, created: () => created };
}

describe("choosing the voice", () => {
  it("uses the recording when the manifest lists the clip for this exact text", () => {
    expect(setup().speaker.voiceFor(prompt)).toBe("recording");
  });

  it("uses the device voice when the prompt has no clip id, an unknown id, or empty manifest", () => {
    const { speaker } = setup();
    expect(speaker.voiceFor({ text: TEXT })).toBe("device-voice");
    expect(speaker.voiceFor({ text: TEXT, clipId: "civics-2008-999" })).toBe("device-voice");
    expect(setup({ manifest: emptyManifest() }).speaker.voiceFor(prompt)).toBe("device-voice");
  });

  it("does not play a clip made for other words (the text changed)", () => {
    expect(setup().speaker.voiceFor({ text: `${TEXT} Now.`, clipId: "civics-2008-001" })).toBe("device-voice");
  });

  it("is null when nothing can speak", () => {
    const { speaker } = setup({ audio: null, fallback: new FakeFallback(false), manifest: emptyManifest() });
    expect(speaker.voiceFor({ text: TEXT })).toBeNull();
  });
});

describe("playing a clip", () => {
  it("starts playback synchronously, inside the tap, from the manifest file", () => {
    const { speaker, audio } = setup();
    void speaker.speak(prompt);
    // No await: Safari only allows audio that starts in the same call as the tap.
    expect((audio as FakeAudio).plays).toEqual(["/audio/civics/2008-001.mp3"]);
  });

  it("resolves when the clip ends and leaves no listeners behind", async () => {
    const { speaker, audio } = setup();
    const done = speaker.speak(prompt);
    (audio as FakeAudio).fire("ended");
    await done;
    expect((audio as FakeAudio).count("ended")).toBe(0);
    expect((audio as FakeAudio).count("error")).toBe(0);
  });

  it("a second tap while playing stops it; the next tap plays again from the start", async () => {
    const { speaker, audio, created } = setup();
    const first = speaker.speak(prompt);
    speaker.cancel(); // the second tap
    await first;
    expect((audio as FakeAudio).pauses).toBe(1);
    const again = speaker.speak(prompt);
    expect((audio as FakeAudio).plays).toHaveLength(2);
    expect((audio as FakeAudio).currentTime).toBe(0);
    (audio as FakeAudio).fire("ended");
    await again;
    expect(created()).toBe(1); // one audio element, reused
  });

  it("starting another prompt stops the one that plays", async () => {
    const { speaker, audio } = setup();
    const first = speaker.speak(prompt);
    const second = speaker.speak(prompt);
    await first;
    expect((audio as FakeAudio).pauses).toBe(1);
    (audio as FakeAudio).fire("ended");
    await second;
  });

  it("a stopped clip does not fall back to the device voice", async () => {
    const { speaker, fallback } = setup();
    const first = speaker.speak(prompt);
    speaker.cancel();
    await first;
    expect(fallback.spoken).toEqual([]);
  });
});

describe("slower playback", () => {
  it("changes only the speed of the same clip", () => {
    const { speaker, audio } = setup();
    void speaker.speak(prompt, { slow: true });
    const element = audio as FakeAudio;
    expect(element.plays).toEqual(["/audio/civics/2008-001.mp3"]);
    expect(element.playbackRate).toBe(SLOW_PLAYBACK_RATE);
    expect(SLOW_PLAYBACK_RATE).toBeLessThan(1);
    expect(element.preservesPitch).toBe(true);
    void speaker.speak(prompt);
    expect(element.plays).toEqual(["/audio/civics/2008-001.mp3", "/audio/civics/2008-001.mp3"]);
    expect(element.playbackRate).toBe(1);
  });
});

describe("falling back to the device voice", () => {
  it("when the clip fails to load", async () => {
    const { speaker, audio, fallback } = setup();
    let notified = 0;
    const done = speaker.speak(prompt, { onFallback: () => notified++ });
    (audio as FakeAudio).fire("error");
    await done;
    expect(notified).toBe(1);
    expect(fallback.spoken).toEqual([prompt]);
  });

  it("when playback is refused", async () => {
    const audio = new FakeAudio();
    audio.failPlay = true;
    const { speaker, fallback } = setup({ audio });
    let notified = 0;
    await speaker.speak(prompt, { onFallback: () => notified++ });
    expect(notified).toBe(1);
    expect(fallback.spoken).toEqual([prompt]);
  });

  it("when the clip is not in the manifest, without touching audio", async () => {
    const { speaker, audio, fallback } = setup({ manifest: emptyManifest() });
    await speaker.speak(prompt);
    expect(fallback.spoken).toEqual([prompt]);
    expect((audio as FakeAudio).plays).toEqual([]);
  });

  it("when the browser has no audio element", async () => {
    const { speaker, fallback } = setup({ audio: null });
    await speaker.speak(prompt);
    expect(fallback.spoken).toEqual([prompt]);
  });
});

describe("the label under the button", () => {
  const render = (speaker: PromptSpeaker, p: SpokenPrompt = prompt) =>
    renderToString(
      <VoiceProvider speaker={speaker} listener={UNSUPPORTED_LISTENER}>
        <SpeakButton text={p.text} {...(p.clipId === undefined ? {} : { clipId: p.clipId })} />
      </VoiceProvider>
    );

  it("says AI-generated voice when a clip will play, and not Device voice", () => {
    const html = render(setup().speaker);
    expect(html).toContain("AI-generated voice");
    expect(html).not.toContain("Device voice");
    expect(html).toContain("Play aloud");
  });

  it("says Device voice only when the device voice is used", () => {
    const html = render(setup({ manifest: emptyManifest() }).speaker);
    expect(html).toContain("Device voice");
    expect(html).not.toContain("AI-generated voice");
  });

  it("with an empty manifest every prompt still has a voice when the device can speak", () => {
    const html = render(setup({ manifest: emptyManifest() }).speaker, { text: "Anything." });
    expect(html).toContain("Play aloud");
  });

  it("says so when nothing can speak", () => {
    const html = render(setup({ audio: null, fallback: new FakeFallback(false), manifest: emptyManifest() }).speaker);
    expect(html).toContain("This browser cannot read aloud");
    expect(html).not.toContain("Play aloud");
  });
});

describe("N-400 screen audio", () => {
  const content = loadPracticeContent();
  const profile = content.profiles[0]!;
  const question = content.n400Questions[0]!;
  const sample = question.sampleAnswers[profile.id]!;

  it("offers play for the question and for the sample answer", () => {
    const m: AudioManifest = {
      ...emptyManifest(),
      clips: {
        [question.id]: { file: `n400/${question.id}.mp3`, hash: hashText(question.text), group: "n400" },
      },
    };
    const speaker = createMp3PromptSpeaker({ manifest: m, fallback: new FakeFallback(), createAudio: () => new FakeAudio() });
    const html = renderToString(
      <VoiceProvider speaker={speaker} listener={UNSUPPORTED_LISTENER}>
        <N400View
          state={{ status: "ready", prompt: { id: question.id, text: question.text, sampleAnswer: sample } }}
          profile={profile}
          answers={[]}
          onAnswer={() => {}}
          onFinish={() => {}}
        />
      </VoiceProvider>
    );
    expect(html).toContain("Play aloud");
    expect(html).toContain("Play sample answer");
    // The question has a clip, the sample answer does not (yet): one of each label.
    expect(html).toContain("AI-generated voice");
    expect(html).toContain("Device voice");
  });
});
