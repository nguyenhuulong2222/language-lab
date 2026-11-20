/**
 * Listen and compare (BS-24): the recording lives in memory for one sentence only, is never sent
 * anywhere, and the sample is never offered before a first attempt.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import controllerSource from "../voice/self-review-controller.ts?raw";
import hookSource from "../voice/use-self-review.ts?raw";
import recorderSource from "../voice/self-review.ts?raw";
import componentSource from "../components/ListenAndCompare.tsx?raw";
import { createSelfReviewRecorder, MAX_RECORDING_MS, type RecorderHost, type RecordStop } from "../voice/self-review";
import { createSelfReviewController, type MinePlayer } from "../voice/self-review-controller";
import { ListenAndCompare } from "../components/ListenAndCompare";
import { VoiceProvider } from "../voice/VoiceProvider";
import { UNSUPPORTED_LISTENER } from "../voice/speech-listener";
import { useSelfReview } from "../voice/use-self-review";
import type { PromptSpeaker } from "../voice/prompt-speaker";

/** A browser with a microphone and a MediaRecorder that records, all in memory, and notes what is open. */
function fakeBrowser(opts: { denyWith?: string; emptyRecording?: boolean } = {}) {
  const state = { tracksStopped: 0, tracksOpen: 0, liveUrls: new Set<string>(), made: 0, timers: [] as Array<() => void> };
  class FakeRecorder {
    state: "inactive" | "recording" = "inactive";
    mimeType = "audio/mp4";
    private listeners = new Map<string, Array<(e: unknown) => void>>();
    constructor(_stream: MediaStream) {}
    addEventListener(type: string, fn: (e: unknown) => void) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
    }
    start() {
      this.state = "recording";
    }
    stop() {
      if (this.state === "inactive") return;
      this.state = "inactive";
      if (!opts.emptyRecording) for (const fn of this.listeners.get("dataavailable") ?? []) fn({ data: new Blob(["audio"]) });
      for (const fn of this.listeners.get("stop") ?? []) fn({});
    }
  }
  const host: RecorderHost = {
    getUserMedia: async () => {
      if (opts.denyWith) throw Object.assign(new Error("no"), { name: opts.denyWith });
      state.tracksOpen++;
      return {
        getTracks: () => [
          {
            stop: () => {
              state.tracksStopped++;
              state.tracksOpen--;
            },
          },
        ],
      } as unknown as MediaStream;
    },
    MediaRecorder: FakeRecorder as unknown as new (stream: MediaStream) => MediaRecorder,
    createObjectURL: () => {
      const url = `blob:test/${++state.made}`;
      state.liveUrls.add(url);
      return url;
    },
    revokeObjectURL: (url) => {
      state.liveUrls.delete(url);
    },
    setTimeout: (fn) => {
      state.timers.push(fn);
      return state.timers.length;
    },
    clearTimeout: () => {},
  };
  return { host, state };
}

afterEach(() => vi.restoreAllMocks());

describe("the recorder", () => {
  it("records, keeps one URL in memory, and discard drops everything", async () => {
    const { host, state } = fakeBrowser();
    const recorder = createSelfReviewRecorder(host);
    expect(recorder.supported).toBe(true);
    expect(await recorder.start()).toEqual({ kind: "recording" });
    expect(state.tracksOpen).toBe(1);
    const result = await recorder.stop();
    expect(result.kind).toBe("recorded");
    expect(state.tracksOpen).toBe(0);
    expect(state.liveUrls.size).toBe(1);
    recorder.discard();
    expect(state.liveUrls.size).toBe(0);
    recorder.discard(); // safe to call again
  });
  it("a new recording throws the old one away", async () => {
    const { host, state } = fakeBrowser();
    const recorder = createSelfReviewRecorder(host);
    await recorder.start();
    await recorder.stop();
    await recorder.start();
    expect(state.liveUrls.size).toBe(0);
    await recorder.stop();
    expect(state.liveUrls.size).toBe(1);
  });
  it("stops by itself after the time limit", async () => {
    const { host, state } = fakeBrowser();
    const recorder = createSelfReviewRecorder(host);
    let auto: RecordStop | null = null;
    await recorder.start((r) => (auto = r));
    expect(MAX_RECORDING_MS).toBeLessThanOrEqual(30_000);
    state.timers[0]!();
    await vi.waitFor(() => expect(auto).not.toBeNull());
    expect((auto as unknown as RecordStop).kind).toBe("recorded");
    expect(state.tracksOpen).toBe(0);
  });
  it("an empty recording is nothing, and the microphone is released", async () => {
    const { host, state } = fakeBrowser({ emptyRecording: true });
    const recorder = createSelfReviewRecorder(host);
    await recorder.start();
    expect(await recorder.stop()).toEqual({ kind: "nothing" });
    expect(state.tracksOpen).toBe(0);
    expect(state.liveUrls.size).toBe(0);
  });
  it("says why it could not start", async () => {
    expect(await createSelfReviewRecorder(fakeBrowser({ denyWith: "NotAllowedError" }).host).start()).toEqual({ kind: "denied" });
    expect(await createSelfReviewRecorder(fakeBrowser({ denyWith: "NotFoundError" }).host).start()).toEqual({ kind: "no-microphone" });
    expect(await createSelfReviewRecorder(fakeBrowser({ denyWith: "WeirdError" }).host).start()).toEqual({ kind: "error", code: "WeirdError" });
    const none = createSelfReviewRecorder({});
    expect(none.supported).toBe(false);
    expect(await none.start()).toEqual({ kind: "unsupported" });
  });
  it("a microphone that arrives after a discard is released at once", async () => {
    const { host, state } = fakeBrowser();
    const recorder = createSelfReviewRecorder(host);
    const pending = recorder.start();
    recorder.discard();
    await pending;
    expect(state.tracksOpen).toBe(0);
  });
});

describe("one sentence at a time", () => {
  const player = (): MinePlayer => ({ play: () => Promise.resolve(), pause: () => {}, onended: null });
  it("no recording is kept after moving on to the next sentence", async () => {
    const { host, state } = fakeBrowser();
    const changes = vi.fn();
    const controller = createSelfReviewController(createSelfReviewRecorder(host), player, changes);
    controller.setSentence("read-001");
    controller.start();
    await vi.waitFor(() => expect(controller.view().phase).toBe("recording"));
    await vi.waitFor(() => expect(state.tracksOpen).toBe(1));
    controller.stop();
    await vi.waitFor(() => expect(controller.view().phase).toBe("recorded"));
    expect(state.liveUrls.size).toBe(1);
    controller.setSentence("read-002");
    expect(controller.view()).toMatchObject({ phase: "idle", problem: null, playingMine: false });
    expect(state.liveUrls.size).toBe(0);
    expect(state.tracksOpen).toBe(0);
  });
  it("no recording is kept when the screen closes, or while recording", async () => {
    const { host, state } = fakeBrowser();
    const controller = createSelfReviewController(createSelfReviewRecorder(host), player, () => {});
    controller.setSentence("read-001");
    controller.start();
    await vi.waitFor(() => expect(state.tracksOpen).toBe(1));
    controller.dispose();
    expect(state.tracksOpen).toBe(0);
    expect(controller.view().phase).toBe("idle");
    expect(state.liveUrls.size).toBe(0);
  });
  it("a result that arrives after the sentence changed is ignored", async () => {
    const { host, state } = fakeBrowser();
    const controller = createSelfReviewController(createSelfReviewRecorder(host), player, () => {});
    controller.setSentence("read-001");
    controller.start();
    controller.setSentence("read-002");
    await new Promise((r) => setTimeout(r, 0));
    expect(controller.view().phase).toBe("idle");
    expect(state.tracksOpen).toBe(0);
    expect(state.liveUrls.size).toBe(0);
  });
  it("plays the learner's own recording and stops it", async () => {
    const { host, state } = fakeBrowser();
    const played: string[] = [];
    const controller = createSelfReviewController(
      createSelfReviewRecorder(host),
      (url) => ({ play: () => (played.push(url), Promise.resolve()), pause: () => played.push("pause"), onended: null }),
      () => {}
    );
    controller.setSentence("read-001");
    controller.start();
    await vi.waitFor(() => expect(controller.view().phase).toBe("recording"));
    await vi.waitFor(() => expect(state.tracksOpen).toBe(1));
    controller.stop();
    await vi.waitFor(() => expect(controller.view().phase).toBe("recorded"));
    controller.toggleMine();
    expect(controller.view().playingMine).toBe(true);
    controller.toggleMine();
    expect(controller.view().playingMine).toBe(false);
    expect(played[0]).toMatch(/^blob:test\//);
    expect(played).toContain("pause");
  });
});

describe("nothing is sent anywhere", () => {
  it("a whole recording session makes no network request", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("no network in this test")));
    vi.stubGlobal("fetch", fetchSpy);
    const xhr = vi.fn();
    vi.stubGlobal("XMLHttpRequest", xhr);
    const beacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    const socket = vi.fn();
    vi.stubGlobal("WebSocket", socket);
    const { host, state } = fakeBrowser();
    const controller = createSelfReviewController(createSelfReviewRecorder(host), () => ({ play: () => Promise.resolve(), pause: () => {}, onended: null }), () => {});
    controller.setSentence("read-001");
    controller.start();
    await vi.waitFor(() => expect(controller.view().phase).toBe("recording"));
    await vi.waitFor(() => expect(state.tracksOpen).toBe(1));
    controller.stop();
    await vi.waitFor(() => expect(controller.view().phase).toBe("recorded"));
    controller.toggleMine();
    controller.setSentence("read-002");
    controller.dispose();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    expect(socket).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("the recording code does not even mention a way to send or store data", () => {
    const forbidden = /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|FormData|localStorage|sessionStorage|indexedDB|IDBFactory|caches|navigator\.serviceWorker|postMessage|BroadcastChannel|RTCPeerConnection)\b/;
    for (const [name, text] of Object.entries({ recorderSource, controllerSource, hookSource, componentSource })) {
      // Comments may explain the rule; strip them before looking.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code, name).not.toMatch(forbidden);
    }
  });
});

describe("the screen part", () => {
  const speaker: PromptSpeaker = {
    available: true,
    voiceFor: () => "device-voice",
    speak: () => Promise.resolve(),
    cancel: () => {},
  } as unknown as PromptSpeaker;
  const sentence = { id: "read-001", text: "Who was George Washington?" };
  const review = (over: Partial<ReturnType<typeof useSelfReview>> = {}) => ({
    supported: true,
    phase: "idle" as const,
    problem: null,
    playingMine: false,
    start: () => {},
    stop: () => {},
    again: () => {},
    toggleMine: () => {},
    ...over,
  });
  const render = (r: ReturnType<typeof review>, attempted: boolean) =>
    renderToString(
      <VoiceProvider speaker={speaker} listener={UNSUPPORTED_LISTENER}>
        <ListenAndCompare review={r} sentence={sentence} attempted={attempted} />
      </VoiceProvider>
    );
  it("before a first attempt: record is offered, the sample is not, and the privacy line is there", () => {
    const html = render(review(), false);
    expect(html).toContain("Record and compare");
    expect(html).not.toContain("Hear the sample");
    expect(html).not.toContain("Try again");
    expect(html).toContain("stays on this device");
    expect(html).toContain("not scored");
  });
  it("while recording: stop is offered, still no sample", () => {
    const html = render(review({ phase: "recording" }), false);
    expect(html).toContain("Stop recording");
    expect(html).not.toContain("Hear the sample");
  });
  it("after a recording: your recording, the sample and try again", () => {
    const html = render(review({ phase: "recorded" }), false);
    expect(html).toContain("Hear your recording");
    expect(html).toContain("Hear the sample");
    expect(html).toContain("Try again");
  });
  it("after a checked attempt the sample and try again are offered even without a recording", () => {
    const html = render(review(), true);
    expect(html).toContain("Hear the sample");
    expect(html).toContain("Try again");
    expect(html).not.toContain("Hear your recording");
  });
  it("a browser that cannot record says so and offers no sample before an attempt", () => {
    const html = render(review({ supported: false }), false);
    expect(html).toContain("cannot record your voice");
    expect(html).not.toContain("Record and compare");
    expect(html).not.toContain("Hear the sample");
  });
  it("shows why a recording did not work", () => {
    expect(render(review({ problem: "selfReview.denied" }), false)).toContain("The microphone is blocked");
  });
});
