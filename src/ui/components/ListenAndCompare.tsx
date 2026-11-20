/**
 * Listen and compare (spec BS-24): the learner records themselves reading the sentence, then hears
 * their own recording and the sample. Self-review only: nothing here is scored.
 *
 * - "Record and compare" is a control of its own, separate from "Say it" (which checks the words).
 *   Recognition and recording may not be able to share the microphone on iPhone Safari.
 * - The sample is not offered until there has been a first attempt: a finished recording here, or a
 *   checked attempt (the feedback view passes `attempted`).
 * - The recording is kept in memory for this sentence only; the privacy line says so.
 */
import { LegalText } from "./LegalText";
import { useEffect, useRef } from "react";
import { readingClipId } from "../../engine/audio-clips";
import { useT } from "../../i18n/react";
import type { SelfReviewState } from "../voice/use-self-review";
import { useListener } from "../voice/VoiceProvider";
import { ReviewIcon } from "./icons";
import { SpeakButton } from "./SpeakButton";
import "./Screen.css";

interface ListenAndCompareProps {
  review: SelfReviewState;
  sentence: { id: string; text: string };
  /** A first attempt has been made (a checked attempt). A finished recording also counts. */
  attempted: boolean;
  /** What "Try again" does. Default: record again. */
  onTryAgain?: () => void;
}

export function ListenAndCompare({ review, sentence, attempted, onTryAgain }: ListenAndCompareProps) {
  const t = useT();
  const listener = useListener();
  const recorded = review.phase === "recorded";
  const busy = review.phase === "starting" || review.phase === "recording";
  // The button that was pressed disappears, so focus goes to the one that replaces it.
  const recordButton = useRef<HTMLButtonElement>(null);
  const stopButton = useRef<HTMLButtonElement>(null);
  const hearButton = useRef<HTMLButtonElement>(null);
  const previous = useRef(review.phase);
  useEffect(() => {
    if (previous.current === review.phase) return;
    previous.current = review.phase;
    if (review.phase === "starting") stopButton.current?.focus();
    else if (review.phase === "recorded") hearButton.current?.focus();
    else if (review.phase === "idle") recordButton.current?.focus();
  }, [review.phase]);
  const sampleAllowed = attempted || recorded;
  if (!review.supported && !sampleAllowed) {
    return (
      <section className="panel" aria-labelledby={`lc-${sentence.id}`}>
        <h2 className="panel__title" id={`lc-${sentence.id}`}>
          {t("selfReview.title")}
        </h2>
        <p className="note">{t("selfReview.unsupported")}</p>
      </section>
    );
  }
  return (
    <section className="panel" aria-labelledby={`lc-${sentence.id}`}>
      <h2 className="panel__title" id={`lc-${sentence.id}`}>
        {t("selfReview.title")}
      </h2>
      {!attempted && <p>{t("selfReview.help")}</p>}
      <div className="btn-row">
        {review.supported && review.phase === "idle" && (
          <button
            type="button"
            ref={recordButton}
            className="btn btn--secondary"
            onClick={() => {
              // One microphone user at a time: stop "Say it" before recording.
              listener.stop();
              review.start();
            }}
          >
            {t("selfReview.record")}
          </button>
        )}
        {review.supported && busy && (
          <button type="button" ref={stopButton} className="btn btn--active" onClick={review.stop}>
            {t("selfReview.stop")}
          </button>
        )}
        {recorded && (
          <button type="button" ref={hearButton} className="btn btn--secondary" onClick={review.toggleMine}>
            {review.playingMine ? t("audio.stop") : t("selfReview.hearYours")}
          </button>
        )}
      </div>
      <p className="status" role="status" aria-live="polite">
        {review.phase === "recording" ? t("selfReview.recording") : ""}
      </p>
      {review.problem !== null && (
        <p className="status status--attention" role="alert">
          <ReviewIcon className="icon-inline icon-inline--attention" /> {t(review.problem)}
        </p>
      )}
      {sampleAllowed && <SpeakButton text={sentence.text} clipId={readingClipId(sentence.id)} labelKey="selfReview.hearSample" />}
      {(recorded || attempted) && (
        <div className="btn-row">
          <button type="button" className="btn btn--secondary" onClick={onTryAgain ?? review.again}>
            {t("selfReview.tryAgain")}
          </button>
        </div>
      )}
      <p className="note"><LegalText messageKey="selfReview.privacy" /></p>
    </section>
  );
}
