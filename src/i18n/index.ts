/**
 * src/i18n/index.ts
 *
 * Screen text lives in locale files (src/i18n/locales/<code>.json), not in components.
 * English is the default and the fallback: a language without a file, or a key missing from
 * a language's file, shows the English text. Nothing here translates anything.
 *
 * Pure module: no React, no DOM, no fetch.
 */
import en from "./locales/en.json";
import { DEFAULT_LANGUAGE, isLanguageCode, type LanguageCode } from "./languages.js";

export type Messages = typeof en;
export type MessageKey = keyof Messages;
export type MessageParams = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;
export type Catalogs = Partial<Record<LanguageCode, Partial<Messages>>>;

/**
 * Every locale file found next to en.json. Today only en.json exists. Other languages' UI text
 * must come from human-reviewed files (content-safety rule 3) and is added by dropping in
 * src/i18n/locales/<code>.json.
 */
function collectCatalogs(): Catalogs {
  const found: Catalogs = {};
  const modules = import.meta.glob<Partial<Messages>>("./locales/*.json", {
    eager: true,
    import: "default",
  });
  for (const [file, messages] of Object.entries(modules)) {
    const code = /\/([a-z]+)\.json$/.exec(file)?.[1];
    if (code !== undefined && isLanguageCode(code)) found[code] = messages;
  }
  return found;
}

export const CATALOGS: Catalogs = collectCatalogs();

/** Replace {name} placeholders. A placeholder with no value is left as written. */
export function interpolate(template: string, params: MessageParams | undefined): string {
  if (params === undefined) return template;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
  );
}

/** A translate function for one language. Falls back to English for anything missing. */
export function createTranslator(
  language: LanguageCode = DEFAULT_LANGUAGE,
  catalogs: Catalogs = CATALOGS
): Translate {
  const own = catalogs[language];
  const fallback: Messages = { ...en, ...catalogs.en };
  return (key, params) => interpolate(own?.[key] ?? fallback[key], params);
}

/** The English text for a key. */
export const tEn: Translate = createTranslator("en");

export { en as ENGLISH_MESSAGES };
export * from "./languages.js";
