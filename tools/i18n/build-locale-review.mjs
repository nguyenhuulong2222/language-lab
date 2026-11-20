#!/usr/bin/env node
/**
 * tools/i18n/build-locale-review.mjs
 *
 * Writes docs/locale-review.md and docs/locale-review/<code>.md from the locale files
 * (generator: src/i18n/review/build-sheets.ts). Run after any change to a locale file or to
 * src/i18n/review/*.json. A test fails when the files in docs/ differ from this output.
 *
 *   node --no-warnings tools/i18n/build-locale-review.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LANGUAGES } from "../../src/i18n/languages.ts";
import { buildIndex, buildSheet, sheetPath } from "../../src/i18n/review/build-sheets.ts";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const en = readJson("src/i18n/locales/en.json");
const OTHER_CODES = LANGUAGES.filter((l) => l.code !== "en").map((l) => l.code);
const catalogs = {};
const status = {};
for (const code of OTHER_CODES) {
  const { _meta, ...messages } = readJson(`src/i18n/locales/${code}.json`);
  catalogs[code] = messages;
  status[code] = _meta;
}
const data = {
  languages: LANGUAGES,
  en,
  catalogs,
  status,
  backTranslations: readJson("src/i18n/review/back-translations.json"),
  viChanges: readJson("src/i18n/review/vi-wording-changes.json"),
};
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, file), text.endsWith("\n") ? text : text + "\n");
};
write("docs/locale-review.md", buildIndex(data));
for (const code of OTHER_CODES) write(sheetPath(code), buildSheet(code, data));
console.log(`Wrote docs/locale-review.md and ${OTHER_CODES.length} sheets.`);
