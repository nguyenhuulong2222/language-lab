/**
 * src/i18n/locale-status-build.ts
 *
 * Builds the content of src/i18n/locale-status.json from the locale files (used by
 * tools/i18n/build-locale-status.mjs and by the test that keeps the file up to date).
 *
 * Pure module: no React, no DOM, no fetch.
 */
import { checkLocale, checkMeta, type LocaleMeta } from "./locale-checks.ts";
export interface LocaleStatusEntry {
  meta: LocaleMeta | null;
  /** The locale file passes every automated check against English. */
  passesChecks: boolean;
}
export type LocaleStatusFile = Record<string, LocaleStatusEntry>;
type RawLocale = Record<string, unknown> & { _meta?: LocaleMeta };
export function buildLocaleStatus(locales: Record<string, RawLocale>): LocaleStatusFile {
  const { _meta: _enMeta, ...en } = locales["en"] ?? {};
  const out: LocaleStatusFile = {};
  for (const code of Object.keys(locales).sort()) {
    if (code === "en") continue;
    const { _meta, ...messages } = locales[code]!;
    const passes =
      checkMeta(_meta).length === 0 &&
      checkLocale(en as Record<string, string>, messages as Record<string, string>).length === 0;
    out[code] = { meta: _meta ?? null, passesChecks: passes };
  }
  return out;
}
