/**
 * Voice input through the browser's speech recognition. It never throws: every result,
 * including "no microphone access" and "this browser cannot do it", is a VoiceOutcome.
 *
 * This path records nothing: it only receives the words the browser heard. (The separate "Record and
 * compare" control, self-review.ts, keeps a recording in memory on the device and never sends it.)
 * Depending on the browser, the recognition
 * itself may be done by the browser maker's service; the intro screen says so.
 */
import {
  outcomeFromError,
  outcomeFromResults,
  type VoiceOutcome,
} from "../../engine/recognition-outcome";

/** How many alternatives the recogniser is asked for. */
export const MAX_ALTERNATIVES = 5;

export interface SpeechListener {
  /** False when this browser has no speech recognition. `listen` then returns "unsupported". */
  readonly supported: boolean;
  /** Listen for one answer. Resolves once, with what happened. */
  listen(): Promise<VoiceOutcome>;
  /** Stop listening now. A pending `listen` resolves with what was heard so far. */
  stop(): void;
}

interface RecognitionWindow {
  SpeechRecognition?: new () => SpeechRecognition;
  webkitSpeechRecognition?: new () => SpeechRecognition;
}

export const UNSUPPORTED_LISTENER: SpeechListener = {
  supported: false,
  listen: () => Promise.resolve({ kind: "unsupported" }),
  stop: () => {},
};

export function createBrowserSpeechListener(
  host: RecognitionWindow | undefined = typeof window === "undefined" ? undefined : (window as unknown as RecognitionWindow)
): SpeechListener {
  const Ctor = host?.SpeechRecognition ?? host?.webkitSpeechRecognition;
  if (Ctor === undefined) return UNSUPPORTED_LISTENER;

  let active: SpeechRecognition | null = null;

  return {
    supported: true,
    listen() {
      return new Promise<VoiceOutcome>((resolve) => {
        let settled = false;
        const finish = (outcome: VoiceOutcome) => {
          if (settled) return;
          settled = true;
          active = null;
          resolve(outcome);
        };
        try {
          const recognition = new Ctor();
          active = recognition;
          recognition.lang = "en-US";
          recognition.interimResults = false;
          recognition.continuous = false;
          // Ask for several ways of hearing the same speech; every one is scored against the sentence.
          recognition.maxAlternatives = MAX_ALTERNATIVES;
          const results: string[][] = [];
          recognition.onresult = (event: SpeechRecognitionEvent) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i];
              if (!result) continue;
              const alternatives: string[] = [];
              for (let k = 0; k < result.length; k++) {
                const alternative = result[k];
                if (alternative) alternatives.push(alternative.transcript);
              }
              if (alternatives.length > 0) results.push(alternatives);
            }
          };
          recognition.onerror = (event: SpeechRecognitionErrorEvent) => finish(outcomeFromError(event.error));
          recognition.onend = () => finish(outcomeFromResults(results));
          recognition.start();
        } catch (error) {
          finish({ kind: "error", code: error instanceof Error ? error.name : "unknown" });
        }
      });
    },
    stop() {
      active?.stop();
    },
  };
}
