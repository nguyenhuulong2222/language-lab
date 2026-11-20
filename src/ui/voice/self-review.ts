/**
 * Self-review recording for listen-and-compare (spec BS-24): the learner records themselves reading
 * the sentence, then hears their own recording next to the sample.
 *
 * PRIVACY. The recording exists only in this module's memory (a Blob behind an object URL), only for
 * the current sentence. It is never uploaded, never stored (no localStorage, no IndexedDB, no file),
 * and `discard()` revokes the URL, stops the microphone and drops the data. The screen calls
 * `discard()` when the sentence changes and when it closes. This file imports and uses no network
 * API; a test fails if it ever mentions one.
 *
 * It never runs together with speech recognition: they are separate controls, because they may not
 * be able to share the microphone on iPhone Safari (to be tested on a device).
 *
 * It never throws: every outcome is data.
 */

/** A recording stops by itself after this long. A reading sentence is short; this stops a forgotten recording. */
export const MAX_RECORDING_MS = 20_000;

export type RecordStart =
  | { kind: "recording" }
  /** The user or the browser refused microphone access. */
  | { kind: "denied" }
  | { kind: "no-microphone" }
  /** This browser has no MediaRecorder or no microphone API. */
  | { kind: "unsupported" }
  | { kind: "error"; code: string };

export type RecordStop = { kind: "recorded"; url: string } | { kind: "nothing" };

export interface SelfReviewRecorder {
  readonly supported: boolean;
  /** Ask for the microphone and start recording. `onAutoStop` is called when the time limit stops it. */
  start(onAutoStop?: (result: RecordStop) => void): Promise<RecordStart>;
  /** Stop and keep the recording in memory. Resolves with an object URL to play it. */
  stop(): Promise<RecordStop>;
  /** Stop the microphone, revoke the URL, drop the recording. Safe to call at any time. */
  discard(): void;
}

/** The browser parts the recorder needs. Tests pass fakes. */
export interface RecorderHost {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  MediaRecorder?: new (stream: MediaStream) => MediaRecorder;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (id: unknown) => void;
}

function browserHost(): RecorderHost {
  if (typeof window === "undefined" || typeof navigator === "undefined") return {};
  const devices = navigator.mediaDevices;
  return {
    ...(devices?.getUserMedia ? { getUserMedia: devices.getUserMedia.bind(devices) } : {}),
    ...(typeof MediaRecorder === "undefined" ? {} : { MediaRecorder }),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id as number),
  };
}

export const UNSUPPORTED_RECORDER: SelfReviewRecorder = {
  supported: false,
  start: () => Promise.resolve({ kind: "unsupported" }),
  stop: () => Promise.resolve({ kind: "nothing" }),
  discard: () => {},
};

function startFailure(error: unknown): RecordStart {
  const name = error instanceof Error ? error.name : "unknown";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return { kind: "denied" };
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return { kind: "no-microphone" };
  return { kind: "error", code: name };
}

export function createSelfReviewRecorder(host: RecorderHost = browserHost()): SelfReviewRecorder {
  const { getUserMedia, MediaRecorder: Recorder, createObjectURL, revokeObjectURL } = host;
  if (!getUserMedia || !Recorder || !createObjectURL || !revokeObjectURL) return UNSUPPORTED_RECORDER;
  const setTimer = host.setTimeout ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = host.clearTimeout ?? ((id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>));

  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let url: string | null = null;
  let timer: unknown = null;
  // Bumped by every discard and start: a microphone that arrives after a discard is released at once.
  let generation = 0;

  const releaseMicrophone = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  };
  const dropRecording = () => {
    if (url !== null) revokeObjectURL(url);
    url = null;
    chunks = [];
  };
  /** Stop the recorder and wait for its last data. */
  const finish = (): Promise<RecordStop> =>
    new Promise((resolve) => {
      const current = recorder;
      if (current === null) {
        resolve({ kind: "nothing" });
        return;
      }
      const done = () => {
        recorder = null;
        releaseMicrophone();
        const size = chunks.reduce((n, c) => n + c.size, 0);
        if (size === 0) {
          chunks = [];
          resolve({ kind: "nothing" });
          return;
        }
        url = createObjectURL(new Blob(chunks, { type: current.mimeType || "audio/mp4" }));
        chunks = [];
        resolve({ kind: "recorded", url });
      };
      if (current.state === "inactive") {
        done();
        return;
      }
      current.addEventListener("stop", done, { once: true });
      try {
        current.stop();
      } catch {
        done();
      }
    });

  function discard() {
    generation++;
    const current = recorder;
    recorder = null;
    if (current !== null && current.state !== "inactive") {
      try {
        current.stop();
      } catch {
        /* already stopped */
      }
    }
    releaseMicrophone();
    dropRecording();
  }

  return {
    supported: true,
    async start(onAutoStop) {
      discard();
      const mine = generation;
      try {
        const opened = await getUserMedia({ audio: true });
        if (generation !== mine) {
          // Discarded while the browser was asking for the microphone.
          opened.getTracks().forEach((track) => track.stop());
          return { kind: "error", code: "cancelled" };
        }
        stream = opened;
        const next = new Recorder(opened);
        recorder = next;
        chunks = [];
        next.addEventListener("dataavailable", (event: BlobEvent) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        });
        next.start();
        timer = setTimer(() => {
          void finish().then((result) => onAutoStop?.(result));
        }, MAX_RECORDING_MS);
        return { kind: "recording" };
      } catch (error) {
        releaseMicrophone();
        recorder = null;
        return startFailure(error);
      }
    },
    stop() {
      if (recorder === null) {
        // Nothing is recording yet: if the browser is still asking for the microphone, cancel that.
        generation++;
        return Promise.resolve({ kind: "nothing" });
      }
      return finish();
    },
    discard,
  };
}
