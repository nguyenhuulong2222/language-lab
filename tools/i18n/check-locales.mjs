#!/usr/bin/env node
/**
 * tools/i18n/check-locales.mjs
 *
 * Runs the automated locale checks (src/i18n/locale-checks.ts) on every locale file and prints the
 * problems. The same checks run as tests and in the app (a locale that fails is not offered).
 *
 *   node --no-warnings tools/i18n/check-locales.mjs          all locales
 *   node --no-warnings tools/i18n/check-locales.mjs vi th    some locales
 *
 * Exit code 1 when any locale has a problem. Needs Node 22.18 or newer (imports TypeScript).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkLocale, checkMeta } from "../../src/i18n/locale-checks.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(ROOT, "src/i18n/locales");
const read = (code) => JSON.parse(fs.readFileSync(path.join(dir, `${code}.json`), "utf8"));
const en = read("en");

const wanted = process.argv.slice(2);
const codes = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -5))
  .filter((c) => c !== "en" && (wanted.length === 0 || wanted.includes(c)));

let bad = 0;
for (const code of codes) {
  const { _meta, ...messages } = read(code);
  const problems = [...checkMeta(_meta), ...checkLocale(en, messages)];
  console.log(`${problems.length === 0 ? "ok  " : "FAIL"} ${code} (${Object.keys(messages).length} lines)`);
  for (const p of problems) console.log(`       ${p.key}: ${p.kind}: ${p.detail}`);
  if (problems.length > 0) bad++;
}
process.exit(bad === 0 ? 0 : 1);
