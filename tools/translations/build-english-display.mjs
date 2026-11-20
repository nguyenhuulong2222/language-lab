#!/usr/bin/env node
/**
 * tools/translations/build-english-display.mjs
 *
 * Builds the official English display files data/translations/civics/{2008,2025}/en.json from the USCIS
 * source files in data/sources/ (the same parser that builds the answer keys). Nothing else is read:
 * no other project and no translation. The files hold the question and the answer lines exactly as
 * USCIS lists them; the app shows them after an answer. Not used for scoring.
 *
 *   node --no-warnings tools/translations/build-english-display.mjs            dry run: report only
 *   node --no-warnings tools/translations/build-english-display.mjs --write    write the two files
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseTxt2025,
  parseHtml2008,
  VERSIONS,
  SOURCE_DIR,
  DYNAMIC_RE,
} from "../answer-key/build-answer-key.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "data/translations/civics");
const pad3 = (n) => String(n).padStart(3, "0");
const write = process.argv.includes("--write");
const SETS = {
  "2008": { parsed: parseHtml2008(path.join(SOURCE_DIR, VERSIONS["2008"].sourceFile)), expected: 100 },
  "2025": { parsed: parseTxt2025(path.join(SOURCE_DIR, VERSIONS["2025"].sourceFile)), expected: 128 },
};
/** Static USCIS answer lines of a question, or null for questions whose answers change. */
function usLines(q) {
  if (q.answers.some((a) => DYNAMIC_RE.test(a.text))) return null;
  return q.answers.map((a) => a.text);
}
let changed = 0;
for (const [version, set] of Object.entries(SETS)) {
  if (set.parsed.questions.length !== set.expected) {
    console.error(`Stopped. ${version}: expected ${set.expected} USCIS questions, found ${set.parsed.questions.length}.`);
    process.exit(1);
  }
  const entries = {};
  for (const q of set.parsed.questions) entries[`${version}-${pad3(q.number)}`] = { question: q.questionText, answers: usLines(q) };
  const out = {
    language: "en",
    testVersion: version,
    note: "Official English display text, taken line by line from the USCIS source file in data/sources/. Not used for scoring.",
    needsHumanReview: false,
    entries,
  };
  const file = path.join(OUT_DIR, version, "en.json");
  const text = JSON.stringify(out, null, 2) + "\n";
  const same = fs.existsSync(file) && fs.readFileSync(file, "utf8") === text;
  console.log(`${version}/en.json: ${Object.keys(entries).length} questions, ${same ? "unchanged" : "DIFFERENT from the file on disk"}`);
  if (!same) changed++;
  if (write) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
}
if (!write && changed > 0) process.exitCode = 1;
