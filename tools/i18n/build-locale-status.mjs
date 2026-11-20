#!/usr/bin/env node
/**
 * tools/i18n/build-locale-status.mjs
 *
 * Writes src/i18n/locale-status.json: for every non-English locale, its `_meta` (source and
 * reviewer) and whether it passes the automated checks. The app reads this small file to build the
 * language menu and the AI label without downloading every locale; a locale file itself is fetched
 * only when it is chosen, and checked again then. A test keeps the file in step with the locales.
 *
 *   node --no-warnings tools/i18n/build-locale-status.mjs
 *
 * Run it after editing a locale file. Needs Node 22.18 or newer (imports TypeScript).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLocaleStatus } from "../../src/i18n/locale-status-build.ts";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(ROOT, "src/i18n/locales");
const locales = Object.fromEntries(
  fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))])
);
const out = path.join(ROOT, "src/i18n/locale-status.json");
fs.writeFileSync(out, JSON.stringify(buildLocaleStatus(locales), null, 2) + "\n");
console.log(`Wrote ${path.relative(ROOT, out)}.`);
