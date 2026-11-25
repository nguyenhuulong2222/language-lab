/**
 * App header: the brand mark with a restrained reel glyph, and a button that opens the
 * language menu, going home (once a session has started), the
 * comfort settings, and "About & disclaimer". The panels open below the header, in the page
 * flow, so they never run off a narrow screen.
 *
 * Keyboard: Escape closes the open panel and returns focus to the button that opened it.
 * "Home" asks first, because it discards the answers of this practice.
 */
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Disclaimer } from "./Disclaimer";
import { LegalText } from "./LegalText";
import { LanguageMenu } from "./LanguageMenu";
import { GlobeIcon } from "./icons";
import { SettingsPanel } from "./SettingsPanel";
import { languageInfo } from "../../i18n/languages";
import { useLanguage, useT } from "../../i18n/react";
import { useSettings } from "../settings";
import "./Header.css";

type PanelName = "language" | "settings" | "about" | "home";

export function Header({ onHome }: { onHome?: () => void }) {
  const t = useT();
  const language = useLanguage();
  const { setLanguage } = useSettings();
  const [panel, setPanel] = useState<PanelName | null>(null);
  const ids = { language: useId(), settings: useId(), about: useId(), home: useId() };
  const buttons = useRef<Record<PanelName, HTMLButtonElement | null>>({ language: null, settings: null, about: null, home: null });

  const panels = useRef<Record<PanelName, HTMLDivElement | null>>({ language: null, settings: null, about: null, home: null });
  // Opening a panel moves focus into it (the language menu focuses its own current choice).
  useEffect(() => {
    if (panel !== null && panel !== "language") panels.current[panel]?.focus();
  }, [panel]);
  // Tabbing out of the header closes the open panel. A click on plain text inside it does not.
  const onBlur = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (panel !== null && next !== null && !event.currentTarget.contains(next)) setPanel(null);
  };
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
    <header className="header" onKeyDown={onKeyDown} onBlur={onBlur}>
      <div className="ll-container header__inner">
        <div className="header__brand">
          <svg className="header__reel" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="12" cy="12" r="3.4" fill="currentColor" />
          </svg>
          <span className="header__brand-name">{t("app.name")}</span>
        </div>
        <div className="header__actions">
          <button
            type="button"
            ref={bind("language")}
            className="header__button header__lang"
            aria-expanded={panel === "language"}
            aria-controls={ids.language}
            onClick={() => toggle("language")}
          >
            <GlobeIcon className="header__globe" />
            <span className="ll-sr-only">{t("lang.label")}: </span>
            <span lang={languageInfo(language).htmlLang}>{languageInfo(language).endonym}</span>
          </button>
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
      <div id={ids.language} className="ll-container header__panel" hidden={panel !== "language"}>
        <LanguageMenu
          open={panel === "language"}
          onChoose={(code) => {
            setLanguage(code);
            close();
          }}
        />
      </div>
      <div
        id={ids.settings}
        ref={(el) => {
          panels.current.settings = el;
        }}
        tabIndex={-1}
        role="region"
        aria-label={t("header.settings")}
        className="ll-container header__panel"
        hidden={panel !== "settings"}
      >
        <SettingsPanel onClose={close} />
      </div>
      <div
        id={ids.about}
        ref={(el) => {
          panels.current.about = el;
        }}
        tabIndex={-1}
        role="region"
        aria-label={t("header.about")}
        className="ll-container header__panel"
        hidden={panel !== "about"}
      >
        <Disclaimer messageKey="disclaimer.full" />
        <p className="note">
          <LegalText messageKey="coach.privacy" />
        </p>
      </div>
      {onHome !== undefined && (
        <div
          id={ids.home}
          ref={(el) => {
            panels.current.home = el;
          }}
          tabIndex={-1}
          role="region"
          aria-label={t("header.home")}
          className="ll-container header__panel"
          hidden={panel !== "home"}
        >
          <p>{t("header.homeConfirm")}</p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setPanel(null);
                onHome();
              }}
            >
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
