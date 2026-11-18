/**
 * App header: the brand mark with a restrained reel glyph, and buttons for going home (once a
 * session has started), the comfort settings, and "About & disclaimer". The panels open below
 * the header, in the page flow, so they never run off a narrow screen. The standing disclaimer
 * is always one tap away.
 */
import { useId, useState } from "react";
import { Disclaimer } from "./Disclaimer";
import { SettingsPanel } from "./SettingsPanel";
import { useT } from "../../i18n/react";
import "./Header.css";

export function Header({ onHome }: { onHome?: () => void }) {
  const t = useT();
  const [panel, setPanel] = useState<"settings" | "about" | null>(null);
  const settingsId = useId();
  const aboutId = useId();
  const toggle = (which: "settings" | "about") => setPanel((current) => (current === which ? null : which));

  return (
    <header className="header">
      <div className="ll-container header__inner">
        <div className="header__brand">
          <svg className="header__reel" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="12" cy="12" r="3.4" fill="currentColor" />
          </svg>
          <span className="header__brand-name">{t("app.name")}</span>
        </div>
        <div className="header__actions">
          {onHome !== undefined && (
            <button type="button" className="header__button" onClick={onHome}>
              {t("header.home")}
            </button>
          )}
          <button
            type="button"
            className="header__button"
            aria-expanded={panel === "settings"}
            aria-controls={settingsId}
            onClick={() => toggle("settings")}
          >
            {t("header.settings")}
          </button>
          <button
            type="button"
            className="header__button"
            aria-expanded={panel === "about"}
            aria-controls={aboutId}
            onClick={() => toggle("about")}
          >
            {t("header.about")}
          </button>
        </div>
      </div>
      <div id={settingsId} className="ll-container header__panel" hidden={panel !== "settings"}>
        <SettingsPanel onClose={() => setPanel(null)} />
      </div>
      <div id={aboutId} className="ll-container header__panel" hidden={panel !== "about"}>
        <Disclaimer text={t("disclaimer.full")} />
      </div>
    </header>
  );
}
