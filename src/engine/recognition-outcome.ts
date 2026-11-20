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
  | { kind: "transcript"; text: string; /** Every way the recogniser heard it, the main one first (it has at least one). */ alternatives: string[] }
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

/** Most alternatives kept (the recogniser is asked for 5 per result; combining results can give more). */
export const MAX_KEPT_ALTERNATIVES = 25;

/**
 * Turn what the recogniser returned into an outcome. `results` has one list per result (a result is
 * one stretch of speech); each list has the alternatives of that result, best first. The main text
 * joins the best alternative of every result. The other alternatives replace one result at a time, so
 * the number of candidates stays small. Blank text means nothing was heard.
 */
export function outcomeFromResults(results: readonly (readonly string[])[]): VoiceOutcome {
  const cleaned = results
    .map((alts) => alts.map((a) => a.trim()).filter((a) => a.length > 0))
    .filter((alts) => alts.length > 0);
  if (cleaned.length === 0) return { kind: "nothing-heard" };
  const best = cleaned.map((alts) => alts[0] as string);
  const text = best.join(" ");
  const alternatives = [text];
  cleaned.forEach((alts, resultIndex) => {
    for (const alt of alts.slice(1)) {
      const joined = best.map((b, i) => (i === resultIndex ? alt : b)).join(" ");
      if (!alternatives.includes(joined)) alternatives.push(joined);
    }
  });
  return { kind: "transcript", text, alternatives: alternatives.slice(0, MAX_KEPT_ALTERNATIVES) };
}

/** Join the pieces of a recognition result. Blank text means nothing was heard. */
export function outcomeFromTranscripts(pieces: readonly string[]): VoiceOutcome {
  return outcomeFromResults(pieces.map((p) => [p]));
}
