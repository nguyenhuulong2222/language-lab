/**
 * The AI label (content-safety rule 3, point a). In every non-English language whose locale file
 * has no named human reviewer, every screen carries this notice: the translation is AI-generated,
 * may contain errors, and the English version is the correct one. It is a compact bar: one line in
 * the chosen language with an info icon, the same line in English (smaller, at least 16px) under
 * it, and the sentence "legal lines stay in English" behind "More".
 */
import { ENGLISH_MESSAGES, isLocaleReviewed } from "../../i18n";
import { useLanguage, useT } from "../../i18n/react";
import { InfoIcon } from "./icons";
import "./AiNotice.css";
export function AiNotice() {
  const t = useT();
  const language = useLanguage();
  if (isLocaleReviewed(language)) return null;
  return (
    <div className="ai-notice" role="note">
      <div className="ll-container ai-notice__inner">
        <InfoIcon className="ai-notice__icon" />
        <div className="ai-notice__body">
          <p className="ai-notice__line">{t("aiNotice.text")}</p>
          <p className="ai-notice__english" lang="en">
            {ENGLISH_MESSAGES["aiNotice.text"]}
          </p>
          <details className="ai-notice__more">
            <summary className="ai-notice__summary">{t("aiNotice.more")}</summary>
            <p className="ai-notice__detail">{t("aiNotice.legalEnglish")}</p>
          </details>
        </div>
      </div>
    </div>
  );
}
