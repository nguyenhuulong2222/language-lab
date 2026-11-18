/**
 * Voice input through the browser's speech recognition. It never throws: every result,
 * including "no microphone access" and "this browser cannot do it", is a VoiceOutcome.
 *
 * No audio is recorded or stored by Language Lab. Depending on the browser, the recognition
 * itself may be done by the browser maker's service; the intro screen says so.
 */
import {
  outcomeFromError,
  outcomeFromTranscripts,
  type VoiceOutcome,
} from "../../engine/recognition-outcome";

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
          recognition.maxAlternatives = 1;
          const pieces: string[] = [];
          recognition.onresult = (event: SpeechRecognitionEvent) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const alternative = event.results[i]?.[0];
              if (alternative) pieces.push(alternative.transcript);
            }
          };
          recognition.onerror = (event: SpeechRecognitionErrorEvent) => finish(outcomeFromError(event.error));
          recognition.onend = () => finish(outcomeFromTranscripts(pieces));
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
