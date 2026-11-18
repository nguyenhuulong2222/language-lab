/**
 * The AI label (content-safety rule 3, point a). In every non-English language whose locale file
 * has no named human reviewer, every screen carries this notice: the translation is AI-generated,
 * may contain errors, and English is the authoritative version. It is said in the chosen
 * language and in English.
 */
import { ENGLISH_MESSAGES, isLocaleReviewed } from "../../i18n";
import { useLanguage, useT } from "../../i18n/react";
import "./AiNotice.css";

export function AiNotice() {
  const t = useT();
  const language = useLanguage();
  if (isLocaleReviewed(language)) return null;
  return (
    <div className="ai-notice" role="note">
      <div className="ll-container ai-notice__inner">
        <p className="ai-notice__text">{t("aiNotice.text")}</p>
        <p className="ai-notice__text ai-notice__text--english" lang="en">
          {ENGLISH_MESSAGES["aiNotice.text"]}
        </p>
      </div>
    </div>
  );
}
