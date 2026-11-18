/**
 * React bindings for src/i18n. Without a provider the language is English.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, type Translate } from "./index";
import { DEFAULT_LANGUAGE, type LanguageCode } from "./languages";

interface I18nValue {
  language: LanguageCode;
  t: Translate;
}

const I18nContext = createContext<I18nValue>({
  language: DEFAULT_LANGUAGE,
  t: createTranslator(DEFAULT_LANGUAGE),
});

export function I18nProvider({
  language,
  children,
}: {
  language: LanguageCode;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ language, t: createTranslator(language) }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Translate {
  return useContext(I18nContext).t;
}

export function useLanguage(): LanguageCode {
  return useContext(I18nContext).language;
}
