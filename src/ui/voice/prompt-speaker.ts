/**
 * Spoken prompts. One small interface, so the screens do not care where the voice comes from.
 *
 * - `createMp3PromptSpeaker` plays a pre-generated MP3 clip (OpenAI text to speech, made ahead
 *   of time by tools/audio/generate-audio.mjs and served as a static file). The app never calls
 *   a TTS service. A clip is used only when the manifest lists it and the text it was made from
 *   is the text about to be spoken. The officer of the practice (`officer`) picks the voice:
 *   that voice's clip first, then officer-a's clip, then the device voice.
 * - `createDeviceVoiceSpeaker` uses the browser's own speech synthesis. It is the fallback when
 *   a clip is missing or fails to load.
 *
 * iPhone Safari only starts audio from a tap. `speak` therefore starts playback synchronously:
 * it must be called straight from the click handler, and it reuses one audio element.
 */
import { officerClipFiles, officerOfFile, type AudioManifest, type OfficerVoiceId } from "../../engine/audio-clips";

export type VoiceKind = "recording" | "device-voice";

export interface SpokenPrompt {
  /** The words to speak. */
  text: string;
  /** Id of the pre-generated clip for this text, when there is one. */
  clipId?: string;
  /**
   * The officer voice of this practice (default officer-a). Used for the officer's lines only; a
   * sample answer always keeps officer-a's clip.
   */
  officer?: OfficerVoiceId;
  /**
   * The text holds the learner's own name ("Use my name"): speak it only with a voice that runs on
   * this device (SpeechSynthesisVoice.localService). Some browsers' default voices are online
   * services, so the text would leave the device. With no local English voice, it is not spoken.
   */
  localOnly?: boolean;
}

/** How fast a recorded clip plays when "slower playback" is on. The same recording, no new audio. */
export const SLOW_PLAYBACK_RATE = 0.7;
/** The device voice's rate: normal, and slower. */
const DEVICE_RATE = 0.9;
const DEVICE_RATE_SLOW = 0.65;

export interface SpeakHandlers {
  /** Called when a clip could not be played and the device voice takes over. */
  onFallback?: () => void;
  /** Play more slowly (comfort setting). */
  slow?: boolean;
  /** Called when nothing could be played: no clip, and no device voice, or the device voice failed. */
  onFailed?: () => void;
  /** Called when a clip of another officer voice takes over (the chosen voice's clip did not load). */
  onOfficer?: (voice: OfficerVoiceId) => void;
}

export interface PromptSpeaker {
  /** False when this browser cannot speak at all. */
  readonly available: boolean;
  /** Which voice `speak` will use now, or null when nothing can speak this prompt. */
  voiceFor(prompt: SpokenPrompt): VoiceKind | null;
  /** The officer voice of the recording `speak` will play, or null when no recording plays. */
  officerFor?(prompt: SpokenPrompt): OfficerVoiceId | null;
  /** Speak the prompt. Resolves when it ends, is cancelled, or fails. Call it from a tap. */
  speak(prompt: SpokenPrompt, handlers?: SpeakHandlers): Promise<void>;
  cancel(): void;
}

/** A speaker that never speaks (server rendering, tests, browsers with no audio). */
export const SILENT_SPEAKER: PromptSpeaker = {
  available: false,
  voiceFor: () => null,
  speak: (_prompt, handlers) => {
    handlers?.onFailed?.();
    return Promise.resolve();
  },
  cancel: () => {},
};

// ---------------------------------------------------------------------------
// Device voice
// ---------------------------------------------------------------------------

/** An English voice that runs on this device (not an online service), US English first; null when there is none. */
export function localEnglishVoice(synthesis: Pick<SpeechSynthesis, "getVoices">): SpeechSynthesisVoice | null {
  const voices = (typeof synthesis.getVoices === "function" ? synthesis.getVoices() : []).filter((v) => v.localService === true && /^en\b/i.test(v.lang));
  return voices.find((v) => /^en[-_]US$/i.test(v.lang)) ?? voices[0] ?? null;
}

export function createDeviceVoiceSpeaker(
  synthesis: SpeechSynthesis | undefined = typeof window === "undefined" ? undefined : window.speechSynthesis
): PromptSpeaker {
  if (synthesis === undefined || typeof SpeechSynthesisUtterance === "undefined") return SILENT_SPEAKER;
  return {
    available: true,
    voiceFor: (prompt) => (prompt.localOnly === true && localEnglishVoice(synthesis) === null ? null : "device-voice"),
    speak({ text, localOnly }, handlers) {
      const local = localOnly === true ? localEnglishVoice(synthesis) : null;
      if (localOnly === true && local === null) {
        handlers?.onFailed?.();
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        if (local !== null) utterance.voice = local;
        utterance.rate = handlers?.slow ? DEVICE_RATE_SLOW : DEVICE_RATE;
        utterance.onend = () => resolve();
        utterance.onerror = (event) => {
          // "canceled" and "interrupted" come from our own cancel(), not from a failure.
          if (event.error !== "canceled" && event.error !== "interrupted") handlers?.onFailed?.();
          resolve();
        };
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
  playbackRate: number;
  /** Keep the voice pitch when the speed changes (where the browser supports it). */
  preservesPitch?: boolean;
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

  // The files that can say a prompt, best first: the practice's officer voice, then officer-a.
  const clipsFor = (prompt: SpokenPrompt): string[] =>
    canPlayAudio && prompt.localOnly !== true ? officerClipFiles(manifest, prompt.officer ?? "officer-a", prompt.clipId, prompt.text) : [];
  const clipFor = (prompt: SpokenPrompt): string | null => clipsFor(prompt)[0] ?? null;
  const speaker: PromptSpeaker = {
    get available() {
      return canPlayAudio || fallback.available;
    },

    voiceFor(prompt) {
      return clipFor(prompt) !== null ? "recording" : fallback.voiceFor(prompt);
    },
    officerFor(prompt) {
      const file = clipFor(prompt);
      return file === null ? null : officerOfFile(file);
    },

    speak(prompt, handlers) {
      // A second tap, or another prompt, always stops what is playing first.
      speaker.cancel();
      const files = clipsFor(prompt);
      if (files.length === 0) return fallback.speak(prompt, handlers);
      audio ??= createAudio();
      const element = audio;
      if (element === null) return fallback.speak(prompt, handlers);
      let next = 0;
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
          // A clip that does not load: try officer-a's clip, then the device voice.
          if (next < files.length) {
            handlers?.onOfficer?.(officerOfFile(files[next]!));
            playNext();
            return;
          }
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
        const playNext = () => {
          const file = files[next++]!;
          element.src = baseUrl + file;
          element.currentTime = 0;
          element.playbackRate = handlers?.slow ? SLOW_PLAYBACK_RATE : 1;
          element.preservesPitch = true;
          const started = element.play();
          if (started !== undefined && typeof started.catch === "function") {
            const attempt = next;
            // Only the attempt that is still current may move on.
            started.catch(() => {
              if (attempt === next) onError();
            });
          }
        };
        // Start now, inside the tap: Safari refuses to start audio later.
        playNext();
      });
    },

    cancel() {
      stopCurrent?.();
      fallback.cancel();
    },
  };
  return speaker;
}
