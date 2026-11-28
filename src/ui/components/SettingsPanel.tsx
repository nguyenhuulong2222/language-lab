/**
 * Text size and voice: opens from the "Text size" button in the header, on every screen.
 * Text size is three big "Aa" choices (a whole tile is the tap target, with a radio mark and a
 * word, so the choice is never shown by colour alone). Slower voice is a large On/Off switch
 * that says "On" or "Off" in words. Officer voice is four radio choices: a different officer each
 * practice, or one of the three officers (each named with the kind of voice, with a "Listen" button
 * that plays that officer asking for the full name). Nothing is stored: the choices last for this
 * page only.
 */
import { useId, useMemo } from "react";
import { n400QuestionClipId, type OfficerVoiceId } from "../../engine/audio-clips";
import { loadPracticeContent } from "../../engine/practice-content";
import type { MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { OFFICER_VOICE_CHOICES, TEXT_SIZES, useSettings, type OfficerVoiceChoice, type TextSize } from "../settings";
import { useSpeaker } from "../voice/VoiceProvider";
import "./Coach.css";
import "./SettingsPanel.css";
const SIZE_LABEL: Record<TextSize, MessageKey> = {
  normal: "settings.textSize.normal",
  large: "settings.textSize.large",
  "extra-large": "settings.textSize.extraLarge",
};
const OFFICER_LABEL: Record<OfficerVoiceChoice, MessageKey> = {
  rotate: "settings.officer.rotate",
  "officer-a": "settings.officer.a",
  "officer-b": "settings.officer.b",
  "officer-c": "settings.officer.c",
};
/** The sample each "Listen" button plays: the first N-400 question, in that officer's voice. */
const LISTEN_QUESTION_ID = "n400-001";
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { textSize, setTextSize, slowPlayback, setSlowPlayback, officerVoice, setOfficerVoice } = useSettings();
  const sizeId = useId();
  const slowId = useId();
  const slowHelpId = useId();
  const officerId = useId();
  const speaker = useSpeaker();
  const listenText = useMemo(() => loadPracticeContent().n400Questions.find((q) => q.id === LISTEN_QUESTION_ID)?.text ?? "", []);
  // Started inside the tap (iPhone Safari). The speaker stops whatever was playing first, so only one plays.
  const listen = (officer: OfficerVoiceId) => {
    void speaker.speak({ text: listenText, clipId: n400QuestionClipId(LISTEN_QUESTION_ID), officer }, { slow: slowPlayback }).catch(() => {});
  };
  return (
    <div className="settings" role="group" aria-label={t("settings.title")}>
      <p className="panel__title">{t("settings.title")}</p>
      <fieldset className="choices">
        <legend className="choices__legend settings__legend">{t("settings.textSize.legend")}</legend>
        <div className="size-choices">
          {TEXT_SIZES.map((size) => (
            <label key={size} className="size-choice">
              <input
                className="choice__input"
                type="radio"
                name="text-size"
                value={size}
                checked={textSize === size}
                onChange={() => setTextSize(size)}
                // Named by the word only; the "Aa" sample is decoration.
                aria-labelledby={`${sizeId}-${size}`}
              />
              <span className={`size-choice__sample size-choice__sample--${size}`} aria-hidden="true">
                {t("settings.textSize.sample")}
              </span>
              <span id={`${sizeId}-${size}`} className="size-choice__text">
                {t(SIZE_LABEL[size])}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="settings__switch-row">
        <span id={slowId} className="settings__legend">
          {t("settings.slow.label")}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={slowPlayback}
          aria-labelledby={slowId}
          aria-describedby={slowHelpId}
          className={slowPlayback ? "coach__switch coach__switch--on settings__switch" : "coach__switch settings__switch"}
          onClick={() => setSlowPlayback(!slowPlayback)}
        >
          <span className="coach__track" aria-hidden="true">
            <span className="coach__thumb" />
          </span>
          <span>{slowPlayback ? t("settings.slow.on") : t("settings.slow.off")}</span>
        </button>
      </div>
      <p id={slowHelpId} className="note">
        {t("settings.slow.help")}
      </p>
      <fieldset className="choices">
        <legend className="choices__legend settings__legend">{t("settings.officer.legend")}</legend>
        {OFFICER_VOICE_CHOICES.map((choice) => (
          <div key={choice} className="officer-choice">
            <label className="choice">
              <input
                className="choice__input"
                type="radio"
                name="officer-voice"
                value={choice}
                checked={officerVoice === choice}
                onChange={() => setOfficerVoice(choice)}
              />
              <span id={`${officerId}-${choice}`} className="choice__text">
                {t(OFFICER_LABEL[choice])}
              </span>
            </label>
            {choice !== "rotate" && listenText !== "" && (
              <button
                type="button"
                className="btn btn--secondary officer-choice__listen"
                aria-describedby={`${officerId}-${choice}`}
                onClick={() => listen(choice)}
              >
                {t("settings.officer.listen")}
              </button>
            )}
          </div>
        ))}
      </fieldset>
      <p className="note">{t("settings.memory")}</p>
      <div className="btn-row">
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          {t("settings.close")}
        </button>
      </div>
    </div>
  );
}
