/**
 * A disclaimer or legal line (src/i18n/legal-keys.ts). In a language without a named reviewer the text
 * is English, so it is marked lang="en" for screen readers.
 */
import type { MessageKey, MessageParams } from "../../i18n";
import { isEnglishOnly } from "../../i18n";
import { useLanguage, useT } from "../../i18n/react";

export function LegalText({ messageKey, params }: { messageKey: MessageKey; params?: MessageParams }) {
  const t = useT();
  const language = useLanguage();
  const text = t(messageKey, params);
  return isEnglishOnly(language, messageKey) ? <span lang="en">{text}</span> : <>{text}</>;
}
