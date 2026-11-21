/**
 * The "AI coach (optional)" switch and its notice (spec REQ-C07, REQ-C14). Off by default. Turning it
 * on opens the notice first; nothing is sent until the learner confirms. While it is on, the three
 * disclaimers show in English.
 */
import { useEffect, useId, useRef } from "react";
import { ENGLISH_MESSAGES, type MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { CoachNotice } from "./CoachNotice";
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
  const switchRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(noticeOpen);
  // The notice focuses its own heading; when it closes, focus comes back to the switch.
  useEffect(() => {
    if (!noticeOpen && wasOpen.current) switchRef.current?.focus();
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
          // aria-disabled, not disabled: the switch stays reachable and its reason is read with it.
          aria-disabled={offForSession || undefined}
          onClick={() => {
            if (offForSession) return;
            if (on) onTurnOff();
            else onRequestOn();
          }}
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
      {noticeOpen && <CoachNotice onConfirm={onConfirm} onCancel={onCancel} />}
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
