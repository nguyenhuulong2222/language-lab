/**
 * The AI coach consent notice (spec REQ-C07), shared by the switch on the N-400 screen and the
 * choice screen before the first question. Nothing is sent until "Turn on the AI coach" is pressed.
 * Its heading takes focus when it opens; Escape cancels.
 */
import { useEffect, useId, useRef } from "react";
import { useT } from "../../i18n/react";
import { LegalText } from "./LegalText";
import "./Coach.css";

export function CoachNotice({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
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
      {/* Attribution as plain text: no Anthropic or Claude logo (spec REQ-C20). */}
      <p className="note">{t("coach.poweredBy")}</p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={onConfirm}>
          {t("coach.notice.confirm")}
        </button>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          {t("coach.notice.cancel")}
        </button>
      </div>
    </div>
  );
}
