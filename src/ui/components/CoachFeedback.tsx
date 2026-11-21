/**
 * The feedback step after an answer while the AI coach is on (spec REQ-C11, REQ-C14): the AI lines
 * with an "AI-generated feedback" label, or the plain fallback line, then "Continue".
 *
 * Screen readers: one status region is mounted from the "checking" line on and its text is
 * replaced by the result, so the result is announced. Focus goes to that region while checking and
 * when the result arrives (it reads it); "Continue" comes next in the tab order, outside the region.
 * The AI lines are English (lang="en"); status is an icon plus a label, never colour alone.
 */
import { useEffect, useRef } from "react";
import type { CoachTurnResult, IdentifierKind } from "../../engine/coach/types";
import { ENGLISH_MESSAGES, isEnglishOnly, tEn, type MessageKey } from "../../i18n";
import { useLanguage, useT } from "../../i18n/react";
import { CheckIcon, ReviewIcon } from "./icons";
import { LegalText } from "./LegalText";
import "./Coach.css";

const KIND_KEY: Record<IdentifierKind, MessageKey> = {
  "a-number": "coach.kind.aNumber",
  ssn: "coach.kind.ssn",
  phone: "coach.kind.phone",
  email: "coach.kind.email",
  "date-of-birth": "coach.kind.dateOfBirth",
};
const FEEDBACK_KEY = {
  understood: "coach.feedback.understood",
  needs_practice: "coach.feedback.needs_practice",
  unclear: "coach.feedback.unclear",
} as const satisfies Record<string, MessageKey>;

export type CoachStep = { status: "checking" } | { status: "done"; result: CoachTurnResult };

export function CoachFeedback({ step, onNext }: { step: CoachStep; onNext: () => void }) {
  const t = useT();
  const language = useLanguage();
  const regionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    regionRef.current?.focus();
  }, [step.status]);
  let body: React.ReactNode;
  if (step.status === "checking") {
    body = <p className="status">{t("coach.checking")}</p>;
  } else {
    const r = step.result;
    if (r.kind === "ai") {
      const Icon = r.reply.feedback === "understood" ? CheckIcon : ReviewIcon;
      // The owner's rule: an "AI-generated feedback" label on every AI line.
      const aiLabel = <span className="coach__ai-label">{t("coach.label")}</span>;
      body = (
        <>
          <p className="coach__line">
            <Icon className={r.reply.feedback === "understood" ? "icon-inline" : "icon-inline icon-inline--attention"} />{" "}
            {t(FEEDBACK_KEY[r.reply.feedback])} {aiLabel}
          </p>
          <p className="note">
            <LegalText messageKey="coach.feedback.scope" />
          </p>
          <p className="progress-line">{t("coach.tip.label")}</p>
          <p className="coach__line">
            <span lang="en">{r.reply.tip}</span> {aiLabel}
          </p>
          <p className="progress-line">{t("coach.followUp.label")}</p>
          <p className="coach__line">
            <span lang="en">{r.reply.followUp}</span> {aiLabel}
          </p>
          <p className="note">
            <LegalText messageKey="coach.followUp.note" />
          </p>
        </>
      );
    } else if (r.kind === "screened") {
      // The kind is put into a legal line: in English when that line is English only.
      const kind = isEnglishOnly(language, "coach.screened") ? tEn(KIND_KEY[r.found]) : t(KIND_KEY[r.found]);
      body = (
        <p className="status status--attention">
          <ReviewIcon className="icon-inline icon-inline--attention" /> <LegalText messageKey="coach.screened" params={{ kind }} />
        </p>
      );
    } else {
      body = (
        <>
          <p className="status status--attention">
            <ReviewIcon className="icon-inline icon-inline--attention" /> {t("coach.unavailable")}
          </p>
          {r.kind === "fallback" && r.disable && <p className="note">{t("coach.offNow")}</p>}
        </>
      );
    }
  }
  return (
    <section className="panel coach__feedback">
      <div ref={regionRef} role="status" aria-live="polite" tabIndex={-1} className="coach__region">
        {body}
      </div>
      {step.status === "done" && step.result.kind === "ai" && (
        <p className="note coach__disclaimer" lang="en">
          {ENGLISH_MESSAGES["disclaimer.report"]}
        </p>
      )}
      {step.status === "done" && (
        <div className="btn-row">
          <button type="button" className="btn" onClick={onNext}>
            {t("coach.next")}
          </button>
        </div>
      )}
    </section>
  );
}
