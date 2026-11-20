/**
 * The state of the listen-and-compare recording of one sentence, without React (spec BS-24), so it
 * can be tested. `use-self-review.ts` wraps it for the screens.
 *
 * The recording belongs to one sentence: `setSentence` with a different key, and `dispose`, throw it
 * away (stop the microphone, revoke the URL). Nothing here sends or stores anything; see self-review.ts.
 */
import type { MessageKey } from "../../i18n";
import type { RecordStop, SelfReviewRecorder } from "./self-review";

export type SelfReviewPhase = "idle" | "recording" | "recorded";

export interface SelfReviewView {
  supported: boolean;
  phase: SelfReviewPhase;
  /** Message to show when the last action did not work. */
  problem: MessageKey | null;
  /** True while the learner's own recording plays. */
  playingMine: boolean;
}

/** What plays the recording. The screen passes `new Audio(url)`; tests pass a fake. */
export interface MinePlayer {
  play(): Promise<void>;
  pause(): void;
  onended: (() => void) | null;
}

export interface SelfReviewController {
  view(): SelfReviewView;
  /** The sentence being practised changed (or became none): drop the recording. */
  setSentence(key: string | null): void;
  start(): void;
  stop(): void;
  toggleMine(): void;
  /** The screen closed: drop the recording. */
  dispose(): void;
}

export function createSelfReviewController(
  recorder: SelfReviewRecorder,
  makePlayer: (url: string) => MinePlayer,
  onChange: () => void
): SelfReviewController {
  let sentence: string | null | undefined;
  let phase: SelfReviewPhase = "idle";
  let problem: MessageKey | null = null;
  let playing: MinePlayer | null = null;
  let url: string | null = null;
  // Each recording gets a number: a result that arrives after the sentence changed is ignored.
  let run = 0;

  const stopPlaying = () => {
    playing?.pause();
    playing = null;
  };
  const drop = () => {
    run++;
    recorder.discard();
    stopPlaying();
    url = null;
    phase = "idle";
    problem = null;
  };
  const keep = (mine: number, result: RecordStop) => {
    if (run !== mine) return;
    if (result.kind === "recorded") {
      url = result.url;
      problem = null;
      phase = "recorded";
    } else {
      url = null;
      problem = "selfReview.error";
      phase = "idle";
    }
    onChange();
  };

  return {
    view: () => ({ supported: recorder.supported, phase, problem, playingMine: playing !== null }),
    setSentence(key) {
      if (sentence === key) return;
      sentence = key;
      drop();
      onChange();
    },
    start() {
      run++;
      const mine = run;
      recorder.discard();
      stopPlaying();
      url = null;
      problem = null;
      phase = "recording";
      onChange();
      void recorder
        .start((result) => keep(mine, result))
        .then((outcome) => {
          if (run !== mine || outcome.kind === "recording") return;
          phase = "idle";
          problem =
            outcome.kind === "denied" ? "selfReview.denied" : outcome.kind === "unsupported" ? "selfReview.unsupported" : "selfReview.error";
          onChange();
        });
    },
    stop() {
      const mine = run;
      void recorder.stop().then((result) => keep(mine, result));
    },
    toggleMine() {
      if (playing !== null) {
        stopPlaying();
        onChange();
        return;
      }
      if (url === null) return;
      // Created inside the tap: iPhone Safari only plays audio started by a tap.
      const player = makePlayer(url);
      playing = player;
      player.onended = () => {
        if (playing === player) {
          playing = null;
          onChange();
        }
      };
      onChange();
      void player.play().catch(() => {
        if (playing === player) {
          playing = null;
          problem = "selfReview.error";
          onChange();
        }
      });
    },
    dispose() {
      drop();
      sentence = undefined;
    },
  };
}
