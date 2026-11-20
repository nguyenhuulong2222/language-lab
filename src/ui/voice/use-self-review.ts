/**
 * Screen hook for listen-and-compare (spec BS-24): wraps the controller in self-review-controller.ts.
 * The recording is dropped whenever `sentenceKey` changes and when the screen closes.
 */
import { useEffect, useReducer, useState } from "react";
import { createSelfReviewController, type MinePlayer, type SelfReviewView } from "./self-review-controller";
import { usePracticeHidden } from "../practice-hidden";
import { useRecorder } from "./VoiceProvider";

export interface SelfReviewState extends SelfReviewView {
  start(): void;
  stop(): void;
  /** Throw the recording away and record again. */
  again(): void;
  /** Play (or stop) the learner's own recording. */
  toggleMine(): void;
}

/** The learner's recording, played through an audio element. */
function playerFor(url: string): MinePlayer {
  const audio = new Audio(url);
  return {
    play: () => audio.play(),
    pause: () => audio.pause(),
    set onended(handler: (() => void) | null) {
      audio.onended = handler;
    },
    get onended() {
      return null;
    },
  };
}

export function useSelfReview(sentenceKey: string | null): SelfReviewState {
  const recorder = useRecorder();
  const hidden = usePracticeHidden();
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [controller] = useState(() => createSelfReviewController(recorder, playerFor, refresh));
  useEffect(() => {
    controller.setSentence(sentenceKey);
  }, [controller, sentenceKey]);
  useEffect(() => {
    if (hidden) controller.suspend();
  }, [controller, hidden]);
  useEffect(() => () => controller.dispose(), [controller]);
  return {
    ...controller.view(),
    start: controller.start,
    stop: controller.stop,
    again: controller.start,
    toggleMine: controller.toggleMine,
  };
}
