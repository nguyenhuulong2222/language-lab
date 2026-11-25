/**
 * The AI coach consent notice (spec REQ-C07), shared by the switch on the N-400 screen and the
 * choice screen before the first question. Nothing is sent until "Turn on the AI coach" is pressed.
 * Its heading takes focus when it opens; Escape cancels.
 */
import { useEffect, useId, useRef } from "react";
import { useT } from "../../i18n/react";
import { LegalText } from "./LegalText";
import "./Coach.css";

/**
 * `primary`: the confirm button is the screen's primary action (the choice screen). Above a question
 * (the switch) the question's own button is primary, so both buttons here are secondary, of equal
 * weight, which also avoids nudging towards consent.
 */
export function CoachNotice({ onConfirm, onCancel, primary = true }: { onConfirm: () => void; onCancel: () => void; primary?: boolean }) {
  const t = useT();
  const noticeId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <div
      className="coach__notice"
      role="group"
      aria-labelledby={noticeId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <h2 id={noticeId} ref={headingRef} tabIndex={-1} className="panel__title">
        {t("coach.notice.title")}
      </h2>
      <p>
        <LegalText messageKey="coach.notice.text" />
      </p>
      {/* What the identifier check cannot do (audit F-08): names are not detected. */}
      <p>
        <LegalText messageKey="coach.notice.limits" />
      </p>
      {/* Attribution as plain text: no Anthropic or Claude logo (spec REQ-C20). */}
      <p className="note">{t("coach.poweredBy")}</p>
      <div className="btn-row">
        <button type="button" className={primary ? "btn btn--primary" : "btn btn--secondary"} onClick={onConfirm}>
          {t("coach.notice.confirm")}
        </button>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          {t("coach.notice.cancel")}
        </button>
      </div>
    </div>
  );
}
