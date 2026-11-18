/**
 * Comfort settings for the session: text size, slower playback of the recorded voice, and the
 * interface language.
 * They live in React state only: nothing is saved in the browser, and they reset when the
 * page is reloaded.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { availableUiLanguages, isProductionBuild, type LanguageCode } from "../i18n";

export type TextSize = "normal" | "large" | "extra-large";

export const TEXT_SIZES: readonly TextSize[] = ["normal", "large", "extra-large"];

export interface Settings {
  textSize: TextSize;
  slowPlayback: boolean;
  /** The interface language. English at the start of every session. */
  language: LanguageCode;
}

export interface SettingsValue extends Settings {
  setTextSize: (size: TextSize) => void;
  setSlowPlayback: (slow: boolean) => void;
  /** Switch the interface language. A language that is not offered (a draft in production) is ignored. */
  setLanguage: (language: LanguageCode) => void;
}

const DEFAULTS: Settings = { textSize: "normal", slowPlayback: false, language: "en" };

const SettingsContext = createContext<SettingsValue>({
  ...DEFAULTS,
  setTextSize: () => {},
  setSlowPlayback: () => {},
  setLanguage: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [textSize, setTextSize] = useState<TextSize>(DEFAULTS.textSize);
  const [slowPlayback, setSlowPlayback] = useState(DEFAULTS.slowPlayback);
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULTS.language);
  const setLanguage = (next: LanguageCode) => {
    if (availableUiLanguages(isProductionBuild()).some((l) => l.code === next)) setLanguageState(next);
  };

  // The page root scales every rem size (type, spacing, tap targets) with the chosen size.
  useEffect(() => {
    document.documentElement.dataset["textSize"] = textSize;
    return () => {
      delete document.documentElement.dataset["textSize"];
    };
  }, [textSize]);

  const value = useMemo<SettingsValue>(
    () => ({ textSize, slowPlayback, language, setTextSize, setSlowPlayback, setLanguage }),
    [textSize, slowPlayback, language]
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  return useContext(SettingsContext);
}
