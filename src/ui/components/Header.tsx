/**
 * App header: the brand mark with a restrained reel glyph, and buttons for the other
 * interface language (when one is offered), going home (once a session has started), the
 * comfort settings, and "About & disclaimer". The panels open below the header, in the page
 * flow, so they never run off a narrow screen.
 *
 * Keyboard: Escape closes the open panel and returns focus to the button that opened it.
 * "Home" asks first, because it discards the answers of this practice.
 */
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Disclaimer } from "./Disclaimer";
import { SettingsPanel } from "./SettingsPanel";
import { AVAILABLE_UI_LANGUAGES } from "../../i18n";
import { useLanguage, useT } from "../../i18n/react";
import { useSettings } from "../settings";
import "./Header.css";

type PanelName = "settings" | "about" | "home";

export function Header({ onHome }: { onHome?: () => void }) {
  const t = useT();
  const language = useLanguage();
  const { setLanguage } = useSettings();
  // Interim until the language menu: English from any other language, otherwise the first other one.
  const otherLanguage =
    language === "en" ? AVAILABLE_UI_LANGUAGES.find((l) => l.code !== "en") : AVAILABLE_UI_LANGUAGES.find((l) => l.code === "en");
  const [panel, setPanel] = useState<PanelName | null>(null);
  const ids = { settings: useId(), about: useId(), home: useId() };
  const buttons = useRef<Record<PanelName, HTMLButtonElement | null>>({ settings: null, about: null, home: null });

  const toggle = (which: PanelName) => setPanel((current) => (current === which ? null : which));
  /** Close the open panel and put focus back on the button that opened it. */
  const close = () => {
    const open = panel;
    setPanel(null);
    if (open !== null) buttons.current[open]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && panel !== null) {
      event.stopPropagation();
      close();
    }
  };
  const bind = (name: PanelName) => (element: HTMLButtonElement | null) => {
    buttons.current[name] = element;
  };

  return (
    <header className="header" onKeyDown={onKeyDown}>
      <div className="ll-container header__inner">
        <div className="header__brand">
          <svg className="header__reel" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="12" cy="12" r="3.4" fill="currentColor" />
          </svg>
          <span className="header__brand-name">{t("app.name")}</span>
        </div>
        <div className="header__actions">
          {otherLanguage !== undefined && (
            <button
              type="button"
              className="header__button header__lang"
              title={t("lang.menu.title")}
              onClick={() => setLanguage(otherLanguage.code)}
            >
              <span className="ll-sr-only">{t("lang.label")}: </span>
              <span lang={otherLanguage.code}>{otherLanguage.endonym}</span>
            </button>
          )}
          {onHome !== undefined && (
            <button
              type="button"
              ref={bind("home")}
              className="header__button"
              aria-expanded={panel === "home"}
              aria-controls={ids.home}
              onClick={() => toggle("home")}
            >
              {t("header.home")}
            </button>
          )}
          <button
            type="button"
            ref={bind("settings")}
            className="header__button"
            aria-expanded={panel === "settings"}
            aria-controls={ids.settings}
            onClick={() => toggle("settings")}
          >
            {t("header.settings")}
          </button>
          <button
            type="button"
            ref={bind("about")}
            className="header__button"
            aria-expanded={panel === "about"}
            aria-controls={ids.about}
            onClick={() => toggle("about")}
          >
            {t("header.about")}
          </button>
        </div>
      </div>
      <div id={ids.settings} className="ll-container header__panel" hidden={panel !== "settings"}>
        <SettingsPanel onClose={close} />
      </div>
      <div id={ids.about} className="ll-container header__panel" hidden={panel !== "about"}>
        <Disclaimer messageKey="disclaimer.full" />
      </div>
      {onHome !== undefined && (
        <div id={ids.home} className="ll-container header__panel" hidden={panel !== "home"}>
          <p>{t("header.homeConfirm")}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={onHome}>
              {t("header.homeConfirm.yes")}
            </button>
            <button type="button" className="btn btn--secondary" onClick={close}>
              {t("header.homeConfirm.no")}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
