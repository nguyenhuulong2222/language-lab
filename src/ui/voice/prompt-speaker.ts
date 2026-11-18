/**
 * Spoken prompts. One small interface, so the screens do not care where the voice comes from.
 *
 * Today the voice is the browser's speech synthesis, which is the voice installed on the
 * user's device ("device voice"); the screens say so. Pre-generated MP3 files can replace it
 * later: implement `PromptSpeaker` with kind "recording" and pass it to VoiceProvider.
 * Nothing here makes a network request.
 */

export interface PromptSpeaker {
  /** "device-voice": the browser's voice. "recording": a pre-generated audio file. */
  readonly kind: "device-voice" | "recording";
  /** False when this browser cannot speak. The screen then shows the text only. */
  readonly available: boolean;
  /** Speak the text. Resolves when it ends, or when it is cancelled or fails. */
  speak(text: string): Promise<void>;
  cancel(): void;
}

/** A speaker that is never available (server rendering, tests, browsers without synthesis). */
export const SILENT_SPEAKER: PromptSpeaker = {
  kind: "device-voice",
  available: false,
  speak: () => Promise.resolve(),
  cancel: () => {},
};

export function createDeviceVoiceSpeaker(
  synthesis: SpeechSynthesis | undefined = typeof window === "undefined" ? undefined : window.speechSynthesis
): PromptSpeaker {
  if (synthesis === undefined || typeof SpeechSynthesisUtterance === "undefined") return SILENT_SPEAKER;
  return {
    kind: "device-voice",
    available: true,
    speak(text) {
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
