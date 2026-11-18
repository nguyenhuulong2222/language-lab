/**
 * Comfort settings: text size and slower playback. Opens from the header on every screen.
 */
import type { MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { TEXT_SIZES, useSettings, type TextSize } from "../settings";
import "./SettingsPanel.css";

const SIZE_LABEL: Record<TextSize, MessageKey> = {
  normal: "settings.textSize.normal",
  large: "settings.textSize.large",
  "extra-large": "settings.textSize.extraLarge",
};

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { textSize, setTextSize, slowPlayback, setSlowPlayback } = useSettings();
  return (
    <div className="settings">
      <h2 className="panel__title">{t("settings.title")}</h2>

      <fieldset className="choices">
        <legend className="choices__legend settings__legend">{t("settings.textSize.legend")}</legend>
        {TEXT_SIZES.map((size) => (
          <label key={size} className="choice">
            <input
              className="choice__input"
              type="radio"
              name="text-size"
              value={size}
              checked={textSize === size}
              onChange={() => setTextSize(size)}
            />
            <span className="choice__text">{t(SIZE_LABEL[size])}</span>
          </label>
        ))}
      </fieldset>

      <label className="choice">
        <input
          className="choice__input"
          type="checkbox"
          checked={slowPlayback}
          onChange={(event) => setSlowPlayback(event.target.checked)}
        />
        <span className="choice__text">
          <span>{t("settings.slow.label")}</span>
          <span className="choice__sub">{t("settings.slow.help")}</span>
        </span>
      </label>

      <p className="note">{t("settings.memory")}</p>
      <div className="btn-row">
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          {t("settings.close")}
        </button>
      </div>
    </div>
  );
}
