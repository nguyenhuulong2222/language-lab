/**
 * The list of interface languages, each under its own name, English first. It is a list of
 * buttons (not radio buttons: arrow keys on radios would change the language as they move).
 * Arrow keys, Home and End move focus; Enter or Space chooses. The current language is marked
 * with `aria-current` and a check icon, not by colour alone. The list may show in several columns;
 * the arrow keys still move in reading order, not by row.
 */
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { AVAILABLE_UI_LANGUAGES, SOME_LANGUAGES_IN_REVIEW, type LanguageCode } from "../../i18n";
import { useLanguage, useT } from "../../i18n/react";
import { languageInfo } from "../../i18n/languages";
import { CheckIcon } from "./icons";
import "./LanguageMenu.css";

export function LanguageMenu({ open, onChoose }: { open: boolean; onChoose: (code: LanguageCode) => void }) {
  const t = useT();
  const current = useLanguage();
  const titleId = useId();
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  // When the menu opens, focus goes to the current language.
  useEffect(() => {
    if (!open) return;
    const index = AVAILABLE_UI_LANGUAGES.findIndex((l) => l.code === current);
    items.current[Math.max(index, 0)]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onKeyDown = (event: KeyboardEvent) => {
    const count = AVAILABLE_UI_LANGUAGES.length;
    const at = items.current.findIndex((el) => el === document.activeElement);
    let next = -1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (at + 1) % count;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = at < 0 ? count - 1 : (at - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    if (next >= 0) {
      event.preventDefault();
      items.current[next]?.focus();
    }
  };

  return (
    <div role="group" aria-labelledby={titleId} onKeyDown={onKeyDown}>
      <p id={titleId} className="language-menu__title">
        {t("lang.menu.title")}
      </p>
      <ul className="language-menu__list">
        {AVAILABLE_UI_LANGUAGES.map((language, index) => {
          const isCurrent = language.code === current;
          return (
            <li key={language.code}>
              <button
                type="button"
                ref={(el) => {
                  items.current[index] = el;
                }}
                className="language-menu__option"
                lang={languageInfo(language.code).htmlLang}
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => onChoose(language.code)}
              >
                <span>{language.endonym}</span>
                {isCurrent && <CheckIcon className="language-menu__check" />}
              </button>
            </li>
          );
        })}
      </ul>
      {SOME_LANGUAGES_IN_REVIEW && <p className="language-menu__review">{t("lang.menu.inReview")}</p>}
    </div>
  );
}
