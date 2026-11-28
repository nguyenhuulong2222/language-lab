/**
 * Text size and voice: opens from the "Text size" button in the header, on every screen.
 * Text size is three big "Aa" choices (a whole tile is the tap target, with a radio mark and a
 * word, so the choice is never shown by colour alone). Slower voice is a large On/Off switch
 * that says "On" or "Off" in words. Officer voice is two radio choices: a different officer each
 * practice, or always the same voice. Nothing is stored: the choices last for this page only.
 */
import { useId } from "react";
import type { MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { OFFICER_VOICE_CHOICES, TEXT_SIZES, useSettings, type OfficerVoiceChoice, type TextSize } from "../settings";
import "./Coach.css";
import "./SettingsPanel.css";
const SIZE_LABEL: Record<TextSize, MessageKey> = {
  normal: "settings.textSize.normal",
  large: "settings.textSize.large",
  "extra-large": "settings.textSize.extraLarge",
};
const OFFICER_LABEL: Record<OfficerVoiceChoice, MessageKey> = {
  rotate: "settings.officer.rotate",
  same: "settings.officer.same",
};
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { textSize, setTextSize, slowPlayback, setSlowPlayback, officerVoice, setOfficerVoice } = useSettings();
  const sizeId = useId();
  const slowId = useId();
  const slowHelpId = useId();
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
          <label key={choice} className="choice">
            <input
              className="choice__input"
              type="radio"
              name="officer-voice"
              value={choice}
              checked={officerVoice === choice}
              onChange={() => setOfficerVoice(choice)}
            />
            <span className="choice__text">{t(OFFICER_LABEL[choice])}</span>
          </label>
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
