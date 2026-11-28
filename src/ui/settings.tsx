/**
 * Comfort settings for the session: text size, slower playback of the recorded voice, the officer
 * voice (a different officer each practice, or one chosen officer), and the interface language.
 * They live in React state only: nothing is saved in the browser, and they reset when the
 * page is reloaded. The language starts as the device's language when this build offers it
 * (detectLanguage), English otherwise; that runs again on every load.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { OFFICER_VOICES, type OfficerVoiceId } from "../engine/audio-clips";
import { AVAILABLE_UI_LANGUAGES, DEFAULT_LANGUAGE, detectLanguage, isLocaleLoaded, loadLocale, type LanguageCode } from "../i18n";

/** The device's preferred languages, most preferred first (navigator.languages, then navigator.language). */
function preferredLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  const list = navigator.languages;
  if (list !== undefined && list.length > 0) return list;
  return navigator.language ? [navigator.language] : [];
}

/** The language to start in: the device's language when this build offers it, else English. */
export function startupLanguage(): LanguageCode {
  return detectLanguage(
    preferredLanguages(),
    AVAILABLE_UI_LANGUAGES.map((l) => l.code)
  );
}

export type TextSize = "normal" | "large" | "extra-large";

export const TEXT_SIZES: readonly TextSize[] = ["normal", "large", "extra-large"];
/** "rotate": a different officer voice each practice (default). An officer id: that officer for every practice. */
export type OfficerVoiceChoice = "rotate" | OfficerVoiceId;
export const OFFICER_VOICE_CHOICES: readonly OfficerVoiceChoice[] = ["rotate", ...OFFICER_VOICES];

export interface Settings {
  textSize: TextSize;
  slowPlayback: boolean;
  officerVoice: OfficerVoiceChoice;
  /** The interface language. The device's language (when offered) or English at the start of every load. */
  language: LanguageCode;
}

export interface SettingsValue extends Settings {
  setTextSize: (size: TextSize) => void;
  setSlowPlayback: (slow: boolean) => void;
  setOfficerVoice: (choice: OfficerVoiceChoice) => void;
  /** Switch the interface language. A language that is not offered (it fails the checks) is ignored. */
  setLanguage: (language: LanguageCode) => void;
}

const DEFAULTS: Settings = { textSize: "normal", slowPlayback: false, officerVoice: "rotate", language: "en" };

const SettingsContext = createContext<SettingsValue>({
  ...DEFAULTS,
  setTextSize: () => {},
  setSlowPlayback: () => {},
  setOfficerVoice: () => {},
  setLanguage: () => {},
});

export function SettingsProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage?: LanguageCode }) {
  const [textSize, setTextSize] = useState<TextSize>(DEFAULTS.textSize);
  const [slowPlayback, setSlowPlayback] = useState(DEFAULTS.slowPlayback);
  const [officerVoice, setOfficerVoice] = useState<OfficerVoiceChoice>(DEFAULTS.officerVoice);
  // Worked out once. main.tsx loads its locale before the first paint; if it is not loaded yet
  // (tests, a slow file), English shows until it arrives.
  const [start] = useState<LanguageCode>(() => initialLanguage ?? startupLanguage());
  const [language, setLanguageState] = useState<LanguageCode>(() => (isLocaleLoaded(start) ? start : DEFAULT_LANGUAGE));
  // The locale file is fetched first; the interface switches when it has arrived and passed the checks.
  // Only the last choice counts, if two arrive out of order.
  const latest = useRef<LanguageCode>(language);
  const setLanguage = (next: LanguageCode) => {
    if (!AVAILABLE_UI_LANGUAGES.some((l) => l.code === next)) return;
    latest.current = next;
    void loadLocale(next).then((ok) => {
      if (ok && latest.current === next) setLanguageState(next);
    });
  };

  useEffect(() => {
    if (start !== latest.current) setLanguage(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The page root scales every rem size (type, spacing, tap targets) with the chosen size.
  useEffect(() => {
    document.documentElement.dataset["textSize"] = textSize;
    return () => {
      delete document.documentElement.dataset["textSize"];
    };
  }, [textSize]);

  const value = useMemo<SettingsValue>(
    () => ({ textSize, slowPlayback, officerVoice, language, setTextSize, setSlowPlayback, setOfficerVoice, setLanguage }),
    [textSize, slowPlayback, officerVoice, language]
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  return useContext(SettingsContext);
}
