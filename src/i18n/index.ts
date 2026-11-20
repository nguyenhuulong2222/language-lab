/**
 * src/i18n/index.ts
 *
 * Screen text lives in locale files (src/i18n/locales/<code>.json), not in components.
 * English is the default and the fallback: a language without a file, or a key missing from
 * a language's file, shows the English text. Nothing here translates anything.
 *
 * Every non-English locale is an AI-written draft until a reviewer is recorded in its _meta. A
 * locale is offered when it passes the automated checks (localePassesChecks); the screens show the
 * AI label while no reviewer is recorded (isLocaleReviewed).
 *
 * Pure module: no React, no DOM, no fetch.
 */
import en from "./locales/en.json";
import STATUS_FILE from "./locale-status.json";
import { checkLocale, checkMeta, isReviewed, type LocaleMeta } from "./locale-checks.js";
import { isLegalKey } from "./legal-keys.js";
import {
  DEFAULT_LANGUAGE,
  IN_REVIEW_LANGUAGES,
  isLanguageCode,
  LANGUAGE_CODES,
  LANGUAGES,
  type LanguageCode,
  type LanguageInfo,
} from "./languages.js";

export type Messages = typeof en;
export type MessageKey = keyof Messages;
export type MessageParams = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;
export type Catalogs = Partial<Record<LanguageCode, Partial<Messages>>>;

/**
 * What a locale file says about itself, under the "_meta" key (not a message): where its text
 * came from and who reviewed it (see locale-checks.ts).
 */
export type { LocaleMeta };
export type LocaleStatus = Partial<Record<LanguageCode, LocaleMeta>>;

type RawLocale = Partial<Messages> & { _meta?: LocaleMeta };

/**
 * English is in the first download. Every other locale file is fetched only when it is chosen
 * (loadLocale), so a visitor downloads one language, not fourteen. The menu and the AI label read
 * src/i18n/locale-status.json instead: each locale's `_meta` and whether it passed the checks when
 * the file was built (tools/i18n/build-locale-status.mjs; a test keeps it in step).
 */
const LAZY_LOCALES = import.meta.glob<RawLocale>(["./locales/*.json", "!./locales/en.json"], { import: "default" });
const STATUS = STATUS_FILE as Record<string, { meta: LocaleMeta | null; passesChecks: boolean }>;
/** The message catalogues in memory: English, and each language once it has been loaded. */
export const CATALOGS: Catalogs = { en };
export const LOCALE_STATUS: LocaleStatus = Object.fromEntries(
  Object.entries(STATUS)
    .filter(([code, entry]) => isLanguageCode(code) && entry.meta !== null)
    .map(([code, entry]) => [code, entry.meta])
) as LocaleStatus;
export function isLocaleLoaded(code: LanguageCode): boolean {
  return CATALOGS[code] !== undefined;
}
/**
 * Fetch a locale file and check it again against English. Resolves true when the language can be
 * shown; false when the file is missing or fails a check (the interface then stays as it is).
 */
export async function loadLocale(code: LanguageCode): Promise<boolean> {
  if (isLocaleLoaded(code)) return true;
  const load = LAZY_LOCALES[`./locales/${code}.json`];
  if (load === undefined) return false;
  const { _meta, ...messages } = await load();
  if (checkMeta(_meta).length > 0) return false;
  if (checkLocale(en as Record<string, string>, messages as Record<string, string>).length > 0) return false;
  CATALOGS[code] = messages;
  if (_meta !== undefined) LOCALE_STATUS[code] = _meta;
  return true;
}
/** Load every locale (tests and tools). */
export async function preloadAllLocales(): Promise<void> {
  await Promise.all(LANGUAGE_CODES.map((code) => loadLocale(code)));
}
/** The languages the interface can be switched to: all 14, English first. A locale must still pass the checks. */
export const UI_LANGUAGE_CODES: readonly LanguageCode[] = LANGUAGE_CODES;

/**
 * True when a locale file is valid and passes every automated check against English
 * (locale-checks.ts). English always passes. This is the gate: a locale that fails is not offered.
 */
export function localePassesChecks(
  code: LanguageCode,
  catalogs: Catalogs = CATALOGS,
  status: LocaleStatus = LOCALE_STATUS
): boolean {
  if (code === DEFAULT_LANGUAGE) return true;
  const messages = catalogs[code];
  if (checkMeta(status[code]).length > 0) return false;
  // Not loaded yet: the result recorded when locale-status.json was built (checked again on load).
  if (messages === undefined) return catalogs === CATALOGS && STATUS[code]?.passesChecks === true;
  return checkLocale(en as Record<string, string>, messages as Record<string, string>).length === 0;
}

/**
 * The interface languages to offer, English first, then the others in the order of languages.ts.
 * In a production build the languages of IN_REVIEW_LANGUAGES are left out until a reviewer is recorded.
 */
export function availableUiLanguages(
  catalogs: Catalogs = CATALOGS,
  status: LocaleStatus = LOCALE_STATUS,
  production: boolean = import.meta.env.PROD
): LanguageInfo[] {
  return LANGUAGES.filter(
    (language) =>
      localePassesChecks(language.code, catalogs, status) &&
      !(production && IN_REVIEW_LANGUAGES.includes(language.code) && !isReviewed(status[language.code]))
  );
}

/** The languages offered in this build, worked out once (the locale files do not change while the app runs). */
export const AVAILABLE_UI_LANGUAGES: readonly LanguageInfo[] = availableUiLanguages();

/** True when this build leaves some language out of the menu because it is still in review. */
export const SOME_LANGUAGES_IN_REVIEW: boolean = AVAILABLE_UI_LANGUAGES.length < LANGUAGES.length;

/**
 * True when the interface text of a language has been reviewed by a named person (so the screen
 * does not carry the AI label). English is the source and needs no label.
 */
export function isLocaleReviewed(code: LanguageCode, status: LocaleStatus = LOCALE_STATUS): boolean {
  return code === DEFAULT_LANGUAGE || isReviewed(status[code]);
}

/** Replace {name} placeholders. A placeholder with no value is left as written. */
export function interpolate(template: string, params: MessageParams | undefined): string {
  if (params === undefined) return template;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
  );
}

/**
 * True when a key is shown in English in this language: it is a disclaimer or legal line (legal-keys.ts)
 * and the language has no named human reviewer. Legal text is never machine translated.
 */
export function isEnglishOnly(code: LanguageCode, key: string, status: LocaleStatus = LOCALE_STATUS): boolean {
  return code !== DEFAULT_LANGUAGE && isLegalKey(key) && !isLocaleReviewed(code, status);
}

/**
 * A translate function for one language. Falls back to English for anything missing, and shows
 * disclaimers and legal lines in English until the language has a named reviewer.
 */
export function createTranslator(
  language: LanguageCode = DEFAULT_LANGUAGE,
  catalogs: Catalogs = CATALOGS,
  status: LocaleStatus = LOCALE_STATUS
): Translate {
  const own = catalogs[language];
  const fallback: Messages = { ...en, ...catalogs.en };
  return (key, params) =>
    interpolate(isEnglishOnly(language, key, status) ? fallback[key] : (own?.[key] ?? fallback[key]), params);
}

/** The English text for a key. */
export const tEn: Translate = createTranslator("en");

export { en as ENGLISH_MESSAGES };
export * from "./languages.js";
export * from "./legal-keys.js";
export * from "./locale-checks.js";
