/**
 * tools/vite/strip-draft-locale.mjs
 *
 * A Vite plugin for production builds. A locale file under src/i18n/locales/ whose _meta says
 * needsHumanReview is not false (a draft) is replaced by a file that holds only its _meta. The
 * draft text is then not in the production bundle at all, not even as unreachable data. The
 * language switcher already hides a draft in production; this removes the text as well.
 *
 * English is never stripped. In development and in tests the plugin does nothing.
 */
import fs from "node:fs";

const LOCALE_FILE = /[\\/]src[\\/]i18n[\\/]locales[\\/]([a-z]+)\.json$/;

/** The text to ship for a locale file: the file itself, or only its _meta when it is a draft. */
export function productionLocaleText(language, rawText) {
  if (language === "en") return rawText;
  const parsed = JSON.parse(rawText);
  const meta = parsed._meta;
  if (meta !== undefined && meta !== null && meta.needsHumanReview === false) return rawText;
  return JSON.stringify({ _meta: { ...(meta ?? {}), needsHumanReview: true } });
}

export function stripDraftLocale() {
  return {
    name: "language-lab-strip-draft-locale",
    apply: "build",
    enforce: "pre",
    load(id) {
      const file = id.split("?")[0];
      const match = LOCALE_FILE.exec(file);
      if (match === null) return null;
      return productionLocaleText(match[1], fs.readFileSync(file, "utf8"));
    },
  };
}
