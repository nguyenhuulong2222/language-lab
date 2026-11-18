/**
 * src/i18n/index.ts
 *
 * Screen text lives in locale files (src/i18n/locales/<code>.json), not in components.
 * English is the default and the fallback: a language without a file, or a key missing from
 * a language's file, shows the English text. Nothing here translates anything.
 *
 * A locale file can be a draft (_meta.needsHumanReview). Drafts work in development and are
 * hidden from the language switcher in a production build (availableUiLanguages).
 *
 * Pure module: no React, no DOM, no fetch.
 */
import en from "./locales/en.json";
import { DEFAULT_LANGUAGE, isLanguageCode, LANGUAGES, type LanguageCode, type LanguageInfo } from "./languages.js";

export type Messages = typeof en;
export type MessageKey = keyof Messages;
export type MessageParams = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;
export type Catalogs = Partial<Record<LanguageCode, Partial<Messages>>>;

/**
 * What a locale file says about itself, under the "_meta" key (not a message). A locale with
 * needsHumanReview: true is a draft: it is available in development and hidden in a production
 * build until a person has reviewed it and set the flag to false.
 */
export interface LocaleMeta {
  needsHumanReview: boolean;
  note?: string;
}
export type LocaleStatus = Partial<Record<LanguageCode, LocaleMeta>>;

type RawLocale = Partial<Messages> & { _meta?: LocaleMeta };

/**
 * Every locale file in src/i18n/locales/. English is the source. A locale's "_meta" is split off
 * and kept as its status; everything else is the message catalogue.
 */
function loadLocales(): { catalogs: Catalogs; status: LocaleStatus } {
  const catalogs: Catalogs = {};
  const status: LocaleStatus = {};
  const modules = import.meta.glob<RawLocale>("./locales/*.json", { eager: true, import: "default" });
  for (const [file, raw] of Object.entries(modules)) {
    const code = /\/([a-z]+)\.json$/.exec(file)?.[1];
    if (code === undefined || !isLanguageCode(code)) continue;
    const { _meta, ...messages } = raw;
    catalogs[code] = messages;
    if (_meta !== undefined) status[code] = _meta;
  }
  return { catalogs, status };
}

const LOADED = loadLocales();
export const CATALOGS: Catalogs = LOADED.catalogs;
export const LOCALE_STATUS: LocaleStatus = LOADED.status;

/** The languages the interface can be switched to. The other display languages are for civics text only. */
export const UI_LANGUAGE_CODES: readonly LanguageCode[] = ["en", "vi"];

/** True in a production build (the Vite flag). */
export function isProductionBuild(): boolean {
  return typeof import.meta !== "undefined" && (import.meta as { env?: { PROD?: boolean } }).env?.PROD === true;
}

/**
 * The interface languages to offer. English always. Another language only if its catalogue
 * exists, and, in production, only when a person has reviewed it (needsHumanReview is false).
 * A locale with no status counts as unreviewed.
 */
export function availableUiLanguages(
  production: boolean,
  catalogs: Catalogs = CATALOGS,
  status: LocaleStatus = LOCALE_STATUS
): LanguageInfo[] {
  return LANGUAGES.filter((language) => {
    if (!UI_LANGUAGE_CODES.includes(language.code)) return false;
    if (language.code === DEFAULT_LANGUAGE) return true;
    if (catalogs[language.code] === undefined) return false;
    const needsReview = status[language.code]?.needsHumanReview ?? true;
    return !(production && needsReview);
  });
}

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
