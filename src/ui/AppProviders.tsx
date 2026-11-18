/**
 * The providers around the app: comfort settings (and the chosen language), the interface text
 * for that language, and the voice. All in memory; nothing is stored.
 */
import { useEffect, type ReactNode } from "react";
import { I18nProvider } from "../i18n/react";
import { SettingsProvider, useSettings } from "./settings";
import { VoiceProvider } from "./voice/VoiceProvider";

/** Gives the screens the text of the language chosen in the settings, and sets the page language. */
function Localized({ children }: { children: ReactNode }) {
  const { language } = useSettings();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return <I18nProvider language={language}>{children}</I18nProvider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <Localized>
        <VoiceProvider>{children}</VoiceProvider>
      </Localized>
    </SettingsProvider>
  );
}
