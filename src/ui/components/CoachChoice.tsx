/**
 * Before the first N-400 question (spec REQ-C19): "Would you like to use the AI coach?" with two
 * large buttons. "Use the AI coach" opens the consent notice; nothing is sent until it is
 * confirmed. "No, practice without AI" starts the scripted interview with the coach off. The three
 * disclaimers show in English, as with the switch.
 */
import { useEffect, useId, useRef } from "react";
import { ENGLISH_MESSAGES, type MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { CoachNotice } from "./CoachNotice";
import { TakeHeader } from "./TakeHeader";
import "./Coach.css";
import "./Screen.css";

const DISCLAIMERS: readonly MessageKey[] = ["intro.notice.practice", "intro.notice.legal", "intro.notice.government"];

interface CoachChoiceProps {
  /** The consent notice is open (after "Use", or straight from the home coach card). */
  noticeOpen: boolean;
  onUse: () => void;
  onNo: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CoachChoice({ noticeOpen, onUse, onNo, onConfirm, onCancel }: CoachChoiceProps) {
  const t = useT();
  const useTitleId = useId();
  const useMetaId = useId();
  const useRef_ = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(noticeOpen);
  // The notice focuses its own heading; after Cancel, focus comes back to "Use the AI coach".
  useEffect(() => {
    if (!noticeOpen && wasOpen.current) useRef_.current?.focus();
    wasOpen.current = noticeOpen;
  }, [noticeOpen]);
  return (
    <div className="screen">
      <TakeHeader stage="n400_interview" title={t("coach.choice.title")} lead={t("coach.choice.lead")} focusOnFirstRender={!noticeOpen} />
      <div className="screen__body">
        {noticeOpen ? (
          <div className="panel coach coach--notice-only">
            <CoachNotice onConfirm={onConfirm} onCancel={onCancel} />
          </div>
        ) : (
          <div className="coach__choices">
            <button type="button" ref={useRef_} className="option-card option-card--coach" aria-labelledby={useTitleId} aria-describedby={useMetaId} onClick={onUse}>
              {/* The name is the title; the attribution is read as the description. */}
              <span id={useTitleId} className="option-card__title">
                {t("coach.choice.use")}
              </span>
              <span id={useMetaId} className="option-card__meta">
                {t("coach.poweredBy")}
              </span>
            </button>
            <button type="button" className="option-card" onClick={onNo}>
              <span className="option-card__title">{t("coach.choice.no")}</span>
            </button>
          </div>
        )}
        <ul className="notice-list coach__disclaimers" lang="en">
          {DISCLAIMERS.map((key) => (
            <li key={key}>{ENGLISH_MESSAGES[key]}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
