/**
 * Comfort settings for the session: text size and slower playback of the recorded voice.
 * They live in React state only: nothing is saved in the browser, and they reset when the
 * page is reloaded.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type TextSize = "normal" | "large" | "extra-large";

export const TEXT_SIZES: readonly TextSize[] = ["normal", "large", "extra-large"];

export interface Settings {
  textSize: TextSize;
  slowPlayback: boolean;
}

export interface SettingsValue extends Settings {
  setTextSize: (size: TextSize) => void;
  setSlowPlayback: (slow: boolean) => void;
}

const DEFAULTS: Settings = { textSize: "normal", slowPlayback: false };

const SettingsContext = createContext<SettingsValue>({
  ...DEFAULTS,
  setTextSize: () => {},
  setSlowPlayback: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [textSize, setTextSize] = useState<TextSize>(DEFAULTS.textSize);
  const [slowPlayback, setSlowPlayback] = useState(DEFAULTS.slowPlayback);

  // The page root scales every rem size (type, spacing, tap targets) with the chosen size.
  useEffect(() => {
    document.documentElement.dataset["textSize"] = textSize;
    return () => {
      delete document.documentElement.dataset["textSize"];
    };
  }, [textSize]);

  const value = useMemo<SettingsValue>(
    () => ({ textSize, slowPlayback, setTextSize, setSlowPlayback }),
    [textSize, slowPlayback]
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  return useContext(SettingsContext);
}
