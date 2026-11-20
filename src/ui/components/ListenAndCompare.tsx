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
import { readingClipId } from "../../engine/audio-clips";
import { useT } from "../../i18n/react";
import type { SelfReviewState } from "../voice/use-self-review";
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
  const recorded = review.phase === "recorded";
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
          <button type="button" className="btn btn--secondary" onClick={review.start}>
            {t("selfReview.record")}
          </button>
        )}
        {review.supported && review.phase === "recording" && (
          <button type="button" className="btn btn--active" onClick={review.stop}>
            {t("selfReview.stop")}
          </button>
        )}
        {recorded && (
          <button type="button" className="btn btn--secondary" onClick={review.toggleMine}>
            {review.playingMine ? t("audio.stop") : t("selfReview.hearYours")}
          </button>
        )}
      </div>
      <p className="status" role="status" aria-live="polite">
        {review.phase === "recording" ? t("selfReview.recording") : ""}
        {review.problem !== null && (
          <>
            <ReviewIcon className="icon-inline icon-inline--attention" /> {t(review.problem)}
          </>
        )}
      </p>
      {sampleAllowed && <SpeakButton text={sentence.text} clipId={readingClipId(sentence.id)} labelKey="selfReview.hearSample" />}
      {(recorded || attempted) && (
        <div className="btn-row">
          <button type="button" className="btn btn--secondary" onClick={onTryAgain ?? review.again}>
            {t("selfReview.tryAgain")}
          </button>
        </div>
      )}
      <p className="note">{t("selfReview.privacy")}</p>
    </section>
  );
}
