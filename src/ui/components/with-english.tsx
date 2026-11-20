/**
 * A translated line that quotes English words, with each English word marked `lang="en"` so a screen
 * reader says it in English: You said "elect". The sentence says "elects". The translation is looked up
 * with markers in place of the values, then the markers are replaced by marked-up English.
 */
import type { ReactNode } from "react";
import type { MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";

const OPEN = "\uE000";
const CLOSE = "\uE001";

export function useTWithEnglish(): (key: MessageKey, values: Readonly<Record<string, string>>) => ReactNode[] {
  const t = useT();
  return (key, values) => {
    const markers: Record<string, string> = {};
    for (const name of Object.keys(values)) markers[name] = `${OPEN}${name}${CLOSE}`;
    const parts = t(key, markers).split(new RegExp(`${OPEN}(\\w+)${CLOSE}`));
    // Odd positions are the names of the values.
    return parts.map((part, index) =>
      index % 2 === 1 ? (
        <span key={index} lang="en">
          {values[part] ?? ""}
        </span>
      ) : (
        part
      )
    );
  };
}
