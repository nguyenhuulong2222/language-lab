// @vitest-environment jsdom
/**
 * Officer voices (decisions log T) in the app: one officer for a whole practice, picked from the
 * practice's seed; a new practice or Study first visit picks again; "Always the same voice" uses
 * officer-a; the player's fallback order; sample answers keep officer-a's clip.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { emptyManifest, hashText, pickOfficerVoice, type AudioManifest, type OfficerVoiceId } from "../../engine/audio-clips";
import { ENGLISH_MESSAGES as EN } from "../../i18n";
import { I18nProvider } from "../../i18n/react";
import { SettingsPanel } from "../components/SettingsPanel";
import { PracticeApp } from "../PracticeApp";
import { SettingsProvider, useSettings } from "../settings";
import { createMp3PromptSpeaker, type AudioLike, type PromptSpeaker, type SpokenPrompt } from "../voice/prompt-speaker";
import { UNSUPPORTED_LISTENER } from "../voice/speech-listener";
import { VoiceProvider } from "../voice/VoiceProvider";

const AT = "2026-11-27T10:00:00.000Z";

/** Records every prompt; says every prompt has a recording. */
class SpySpeaker implements PromptSpeaker {
  available = true;
  spoken: SpokenPrompt[] = [];
  voiceFor() {
    return "recording" as const;
  }
  speak(prompt: SpokenPrompt) {
    this.spoken.push(prompt);
    return Promise.resolve();
  }
  cancel() {}
}

/** The first seeds that give each officer. */
const seedFor = (voice: OfficerVoiceId) => {
  for (let s = 1; ; s++) if (pickOfficerVoice(s) === voice) return s;
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  Element.prototype.scrollIntoView = () => {};
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A settings control outside the practice, as the header's panel is. */
function SameVoiceSwitch() {
  const { setOfficerVoice } = useSettings();
  return (
    <button type="button" onClick={() => setOfficerVoice("same")}>
      test: always the same voice
    </button>
  );
}

function Providers({ speaker, children }: { speaker: PromptSpeaker; children: ReactNode }) {
  return (
    <SettingsProvider initialLanguage="en">
      <I18nProvider language="en">
        <VoiceProvider speaker={speaker} listener={UNSUPPORTED_LISTENER}>
          {children}
        </VoiceProvider>
      </I18nProvider>
    </SettingsProvider>
  );
}

function app(seeds: number[]) {
  const speaker = new SpySpeaker();
  const queue = [...seeds];
  const seed = vi.fn(() => queue.shift() ?? 1);
  render(
    <Providers speaker={speaker}>
      <SameVoiceSwitch />
      <PracticeApp now={() => AT} seed={seed} />
    </Providers>
  );
  return { speaker, seed };
}

const button = (text: string) => screen.getAllByRole("button", { name: (name) => name === text || name.startsWith(text) }).at(-1)!;
const findButton = async (text: string) =>
  (await screen.findAllByRole("button", { name: (name) => name === text || name.startsWith(text) }, { timeout: 4000 })).at(-1)!;
/** The officer of the last prompt spoken (officer-a when the prompt names none). */
const lastOfficer = (speaker: SpySpeaker) => speaker.spoken.at(-1)?.officer ?? "officer-a";
const playAgain = async (speaker: SpySpeaker) => {
  const before = speaker.spoken.length;
  fireEvent.click(await findButton(EN["audio.again"]));
  expect(speaker.spoken.length).toBe(before + 1);
  return lastOfficer(speaker);
};

describe("one officer for a whole practice", () => {
  it("keeps the seed's officer for every prompt of the practice, and picks again for the next practice", async () => {
    const b = seedFor("officer-b");
    const c = seedFor("officer-c");
    const { speaker, seed } = app([b, c]);
    fireEvent.click(button(EN["home.part.writing.title"]));
    expect(seed).toHaveBeenCalledTimes(1);
    expect(await playAgain(speaker)).toBe("officer-b");
    expect(await playAgain(speaker)).toBe("officer-b");
    // A second sentence of the same practice: still the same officer.
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Something else entirely." } });
    fireEvent.click(button(EN["writing.submit"]));
    fireEvent.click(await findButton(EN["writing.next"]));
    expect(await playAgain(speaker)).toBe("officer-b");
    fireEvent.click(await findButton(EN["writing.show"]));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: document.querySelector<HTMLElement>(".prompt")!.textContent!.trim() } });
    fireEvent.click(button(EN["writing.submit"]));
    fireEvent.click(await findButton(EN["report.see"]));
    expect(seed).toHaveBeenCalledTimes(1);
    // Home: the next practice has its own seed, so its own officer.
    fireEvent.click(await findButton(EN["report.home"]));
    fireEvent.click(await findButton(EN["home.part.writing.title"]));
    expect(seed).toHaveBeenCalledTimes(2);
    expect(await playAgain(speaker)).toBe("officer-c");
    expect(await playAgain(speaker)).toBe("officer-c");
  });

  it("the same seed gives the same officer on another load", async () => {
    const c = seedFor("officer-c");
    const first = app([c]);
    fireEvent.click(button(EN["home.part.writing.title"]));
    expect(await playAgain(first.speaker)).toBe("officer-c");
    cleanup();
    const second = app([c]);
    fireEvent.click(button(EN["home.part.writing.title"]));
    expect(await playAgain(second.speaker)).toBe("officer-c");
  });

  it("Study first picks once per visit and keeps it from question to question", async () => {
    const b = seedFor("officer-b");
    const { speaker, seed } = app([b]);
    fireEvent.click(button(EN["home.study.title"]));
    fireEvent.click(await findButton(EN["study.version.2008"]));
    expect(seed).toHaveBeenCalledTimes(1);
    expect(await playAgain(speaker)).toBe("officer-b");
    fireEvent.click(button(EN["civics.next"]));
    expect(await playAgain(speaker)).toBe("officer-b");
    expect(seed).toHaveBeenCalledTimes(1);
  });

  it("\"Always the same voice\" uses officer-a, also in the middle of a practice", async () => {
    const b = seedFor("officer-b");
    const { speaker } = app([b, b]);
    fireEvent.click(button(EN["home.part.writing.title"]));
    expect(await playAgain(speaker)).toBe("officer-b");
    fireEvent.click(button("test: always the same voice"));
    expect(await playAgain(speaker)).toBe("officer-a");
    expect(speaker.spoken.at(-1)).not.toHaveProperty("officer");
  });
});

describe("the officer voice setting", () => {
  it("offers the two choices as radio buttons, a different officer each practice first and chosen", () => {
    const speaker = new SpySpeaker();
    render(
      <Providers speaker={speaker}>
        <SettingsPanel onClose={() => {}} />
      </Providers>
    );
    expect(screen.getByRole("group", { name: EN["settings.title"] }).textContent).toContain(EN["settings.officer.legend"]);
    const rotate = screen.getByLabelText(EN["settings.officer.rotate"]) as HTMLInputElement;
    const same = screen.getByLabelText(EN["settings.officer.same"]) as HTMLInputElement;
    expect(rotate.checked).toBe(true);
    expect(same.checked).toBe(false);
    fireEvent.click(same);
    expect(same.checked).toBe(true);
    expect(rotate.checked).toBe(false);
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The player
// ---------------------------------------------------------------------------

class FakeAudio implements AudioLike {
  src = "";
  currentTime = 0;
  playbackRate = 1;
  preservesPitch: boolean | undefined;
  plays: string[] = [];
  private listeners = new Map<string, Set<() => void>>();
  play() {
    this.plays.push(this.src);
    return Promise.resolve();
  }
  pause() {}
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
}

const QUESTION = "What is the supreme law of the land?";
const SAMPLE = "My name is Aurora Thistlewood.";
function playerManifest(): AudioManifest {
  return {
    ...emptyManifest(),
    clips: {
      "civics-2008-001": { file: "civics/2008-001.mp3", hash: hashText(QUESTION), group: "civics-2008" },
      "n400-001-sample-aurora-thistlewood": { file: "n400/n400-001-sample-aurora-thistlewood.mp3", hash: hashText(SAMPLE), group: "n400-samples" },
    },
    voices: {
      "officer-b": {
        tts: { model: "gpt-4o-mini-tts", voice: "cedar", instruction: emptyManifest().tts.instruction },
        clips: { "civics-2008-001": { file: "officer-b/civics/2008-001.mp3", hash: hashText(QUESTION), group: "civics-2008", voice: "officer-b" } },
      },
    },
  };
}

function player() {
  const audio = new FakeAudio();
  const device: SpokenPrompt[] = [];
  const fallback: PromptSpeaker = {
    available: true,
    voiceFor: () => "device-voice",
    speak: (p) => {
      device.push(p);
      return Promise.resolve();
    },
    cancel: () => {},
  };
  const speaker = createMp3PromptSpeaker({ manifest: playerManifest(), fallback, createAudio: () => audio });
  return { audio, device, speaker };
}

describe("the player's fallback order", () => {
  it("plays the chosen officer's clip", () => {
    const { audio, speaker } = player();
    void speaker.speak({ text: QUESTION, clipId: "civics-2008-001", officer: "officer-b" });
    expect(audio.plays).toEqual(["/audio/officer-b/civics/2008-001.mp3"]);
  });

  it("uses officer-a's clip when the chosen officer has none", () => {
    const { audio, speaker } = player();
    void speaker.speak({ text: QUESTION, clipId: "civics-2008-001", officer: "officer-c" });
    expect(audio.plays).toEqual(["/audio/civics/2008-001.mp3"]);
    expect(speaker.voiceFor({ text: QUESTION, clipId: "civics-2008-001", officer: "officer-c" })).toBe("recording");
  });

  it("when a clip fails to load: officer-a's clip, then the device voice", async () => {
    const { audio, device, speaker } = player();
    const onFallback = vi.fn();
    const done = speaker.speak({ text: QUESTION, clipId: "civics-2008-001", officer: "officer-b" }, { onFallback });
    audio.fire("error");
    expect(audio.plays).toEqual(["/audio/officer-b/civics/2008-001.mp3", "/audio/civics/2008-001.mp3"]);
    expect(onFallback).not.toHaveBeenCalled();
    audio.fire("error");
    await done;
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(device).toHaveLength(1);
  });

  it("uses the device voice when no officer has a clip", async () => {
    const { audio, device, speaker } = player();
    await speaker.speak({ text: "Another question?", clipId: "civics-2008-002", officer: "officer-b" });
    expect(audio.plays).toEqual([]);
    expect(device).toHaveLength(1);
  });

  it("a sample answer keeps officer-a's clip, whatever the officer", () => {
    for (const officer of ["officer-a", "officer-b", "officer-c"] as const) {
      const { audio, speaker } = player();
      void speaker.speak({ text: SAMPLE, clipId: "n400-001-sample-aurora-thistlewood", officer });
      expect(audio.plays, officer).toEqual(["/audio/n400/n400-001-sample-aurora-thistlewood.mp3"]);
    }
  });
});
