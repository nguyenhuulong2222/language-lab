/**
 * src/engine/recognition-outcome.ts
 *
 * What can happen when the app asks the browser to listen, as plain data. The browser adapter
 * (src/ui/voice/) turns its events into these; the screens show a message for each.
 * Typed input always works, whatever the outcome.
 *
 * Pure module: no DOM, no network.
 */

export type VoiceOutcome =
  | { kind: "transcript"; text: string }
  /** The user or the browser refused microphone access. */
  | { kind: "denied" }
  /** This browser has no speech recognition. */
  | { kind: "unsupported" }
  /** Listening worked, but no words came back. */
  | { kind: "nothing-heard" }
  /** No microphone was found. */
  | { kind: "no-microphone" }
  /** Anything else. `code` is the browser's error code. */
  | { kind: "error"; code: string };

/** Map a SpeechRecognition error code (event.error) to an outcome. */
export function outcomeFromError(code: string): VoiceOutcome {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return { kind: "denied" };
    case "no-speech":
      return { kind: "nothing-heard" };
    case "audio-capture":
      return { kind: "no-microphone" };
    case "language-not-supported":
      return { kind: "unsupported" };
    default:
      return { kind: "error", code };
  }
}

/** Join the pieces of a recognition result. Blank text means nothing was heard. */
export function outcomeFromTranscripts(pieces: readonly string[]): VoiceOutcome {
  const text = pieces.map((p) => p.trim()).filter((p) => p.length > 0).join(" ");
  return text.length === 0 ? { kind: "nothing-heard" } : { kind: "transcript", text };
}
