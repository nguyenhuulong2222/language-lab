/**
 * Spoken prompts. One small interface, so the screens do not care where the voice comes from.
 *
 * - `createMp3PromptSpeaker` plays a pre-generated MP3 clip (OpenAI text to speech, made ahead
 *   of time by tools/audio/generate-audio.mjs and served as a static file). The app never calls
 *   a TTS service. A clip is used only when the manifest lists it and the text it was made from
 *   is the text about to be spoken.
 * - `createDeviceVoiceSpeaker` uses the browser's own speech synthesis. It is the fallback when
 *   a clip is missing or fails to load.
 *
 * iPhone Safari only starts audio from a tap. `speak` therefore starts playback synchronously:
 * it must be called straight from the click handler, and it reuses one audio element.
 */
import { clipFileFor, type AudioManifest } from "../../engine/audio-clips";

export type VoiceKind = "recording" | "device-voice";

export interface SpokenPrompt {
  /** The words to speak. */
  text: string;
  /** Id of the pre-generated clip for this text, when there is one. */
  clipId?: string;
}

export interface SpeakHandlers {
  /** Called when a clip could not be played and the device voice takes over. */
  onFallback?: () => void;
}

export interface PromptSpeaker {
  /** False when this browser cannot speak at all. */
  readonly available: boolean;
  /** Which voice `speak` will use now, or null when nothing can speak this prompt. */
  voiceFor(prompt: SpokenPrompt): VoiceKind | null;
  /** Speak the prompt. Resolves when it ends, is cancelled, or fails. Call it from a tap. */
  speak(prompt: SpokenPrompt, handlers?: SpeakHandlers): Promise<void>;
  cancel(): void;
}

/** A speaker that never speaks (server rendering, tests, browsers with no audio). */
export const SILENT_SPEAKER: PromptSpeaker = {
  available: false,
  voiceFor: () => null,
  speak: () => Promise.resolve(),
  cancel: () => {},
};

// ---------------------------------------------------------------------------
// Device voice
// ---------------------------------------------------------------------------

export function createDeviceVoiceSpeaker(
  synthesis: SpeechSynthesis | undefined = typeof window === "undefined" ? undefined : window.speechSynthesis
): PromptSpeaker {
  if (synthesis === undefined || typeof SpeechSynthesisUtterance === "undefined") return SILENT_SPEAKER;
  return {
    available: true,
    voiceFor: () => "device-voice",
    speak({ text }) {
      return new Promise<void>((resolve) => {
        synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 0.9;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        synthesis.speak(utterance);
      });
    },
    cancel() {
      synthesis.cancel();
    },
  };
}

// ---------------------------------------------------------------------------
// Pre-generated MP3 clips
// ---------------------------------------------------------------------------

/** The part of an HTML audio element the player uses (a small fake can stand in for tests). */
export interface AudioLike {
  src: string;
  currentTime: number;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: "ended" | "error", listener: () => void): void;
  removeEventListener(type: "ended" | "error", listener: () => void): void;
}

export interface Mp3SpeakerOptions {
  manifest: AudioManifest;
  /** Where the clips are served from. */
  baseUrl?: string;
  /** Used when there is no clip, or the clip fails. */
  fallback: PromptSpeaker;
  /** Makes the audio element. Defaults to the browser's `Audio`; null means no audio support. */
  createAudio?: () => AudioLike | null;
}

function browserAudio(): AudioLike | null {
  return typeof Audio === "undefined" ? null : (new Audio() as AudioLike);
}

export function createMp3PromptSpeaker(options: Mp3SpeakerOptions): PromptSpeaker {
  const { manifest, fallback, baseUrl = "/audio/", createAudio = browserAudio } = options;
  const canPlayAudio = createAudio !== browserAudio || typeof Audio !== "undefined";

  // One element for every clip, created on the first tap and reused, so Safari keeps it unlocked.
  let audio: AudioLike | null = null;
  let stopCurrent: (() => void) | null = null;

  const clipFor = (prompt: SpokenPrompt): string | null =>
    canPlayAudio ? clipFileFor(manifest, prompt.clipId, prompt.text) : null;

  const speaker: PromptSpeaker = {
    get available() {
      return canPlayAudio || fallback.available;
    },

    voiceFor(prompt) {
      return clipFor(prompt) !== null ? "recording" : fallback.voiceFor(prompt);
    },

    speak(prompt, handlers) {
      // A second tap, or another prompt, always stops what is playing first.
      speaker.cancel();

      const file = clipFor(prompt);
      if (file === null) return fallback.speak(prompt, handlers);

      audio ??= createAudio();
      const element = audio;
      if (element === null) return fallback.speak(prompt, handlers);

      return new Promise<void>((resolve) => {
        let settled = false;
        const cleanup = () => {
          element.removeEventListener("ended", onEnded);
          element.removeEventListener("error", onError);
          stopCurrent = null;
        };
        const onEnded = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        };
        const onError = () => {
          if (settled) return;
          settled = true;
          cleanup();
          handlers?.onFallback?.();
          fallback.speak(prompt, handlers).then(resolve, resolve);
        };
        stopCurrent = () => {
          if (settled) return;
          settled = true;
          cleanup();
          element.pause();
          resolve();
        };

        element.addEventListener("ended", onEnded);
        element.addEventListener("error", onError);
        // Start now, inside the tap: Safari refuses to start audio later.
        element.src = baseUrl + file;
        element.currentTime = 0;
        const started = element.play();
        if (started !== undefined && typeof started.catch === "function") started.catch(onError);
      });
    },

    cancel() {
      stopCurrent?.();
      fallback.cancel();
    },
  };
  return speaker;
}
