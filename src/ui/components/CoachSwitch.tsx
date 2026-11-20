/**
 * The "AI coach (optional)" switch and its notice (spec REQ-C07, REQ-C14). Off by default. Turning it
 * on opens the notice first; nothing is sent until the learner confirms. While it is on, the three
 * disclaimers show in English.
 */
import { useEffect, useId, useRef } from "react";
import { ENGLISH_MESSAGES, type MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { LegalText } from "./LegalText";
import "./Coach.css";

interface CoachSwitchProps {
  on: boolean;
  noticeOpen: boolean;
  /** The coach was switched off for this session (server said unavailable, or the turn limit). */
  offForSession: boolean;
  onRequestOn: () => void;
  onTurnOff: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const DISCLAIMERS: readonly MessageKey[] = ["intro.notice.practice", "intro.notice.legal", "intro.notice.government"];

export function CoachSwitch({ on, noticeOpen, offForSession, onRequestOn, onTurnOff, onConfirm, onCancel }: CoachSwitchProps) {
  const t = useT();
  const labelId = useId();
  const helpId = useId();
  const noticeId = useId();
  const switchRef = useRef<HTMLButtonElement>(null);
  const noticeRef = useRef<HTMLHeadingElement>(null);
  const wasOpen = useRef(noticeOpen);
  useEffect(() => {
    if (noticeOpen) noticeRef.current?.focus();
    else if (wasOpen.current) switchRef.current?.focus();
    wasOpen.current = noticeOpen;
  }, [noticeOpen]);
  return (
    <section className="coach panel" aria-labelledby={labelId}>
      <div className="coach__row">
        <span id={labelId} className="coach__label">
          {t("coach.switch.label")}
        </span>
        <button
          type="button"
          ref={switchRef}
          role="switch"
          aria-checked={on}
          aria-labelledby={labelId}
          aria-describedby={helpId}
          className={on ? "coach__switch coach__switch--on" : "coach__switch"}
          disabled={offForSession}
          onClick={() => (on ? onTurnOff() : onRequestOn())}
        >
          <span className="coach__track" aria-hidden="true">
            <span className="coach__thumb" />
          </span>
          <span>{on ? t("coach.switch.on") : t("coach.switch.off")}</span>
        </button>
      </div>
      <p id={helpId} className="note">
        {offForSession ? t("coach.offNow") : t("coach.switch.help")}
      </p>
      {noticeOpen && (
        <div className="coach__notice" role="group" aria-labelledby={noticeId}>
          <h2 id={noticeId} ref={noticeRef} tabIndex={-1} className="panel__title">
            {t("coach.notice.title")}
          </h2>
          <p>
            <LegalText messageKey="coach.notice.text" />
          </p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={onConfirm}>
              {t("coach.notice.confirm")}
            </button>
            <button type="button" className="btn btn--secondary" onClick={onCancel}>
              {t("coach.notice.cancel")}
            </button>
          </div>
        </div>
      )}
      {on && (
        <ul className="notice-list coach__disclaimers" lang="en">
          {DISCLAIMERS.map((key) => (
            <li key={key}>{ENGLISH_MESSAGES[key]}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
