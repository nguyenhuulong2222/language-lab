#!/usr/bin/env node
/**
 * tools/translations/import-n400.mjs
 *
 * Builds the display-only civics translation files in data/translations/civics/ from the
 * N400 project's data.json. The N400 repository is READ ONLY here: this script only reads it.
 *
 *   node --no-warnings tools/translations/import-n400.mjs            dry run: report only
 *   node --no-warnings tools/translations/import-n400.mjs --write    write the files and the
 *                                                                    coverage table in docs/decisions-log.md
 *   N400_DIR=/path/to/N400 overrides the default /Volumes/Crucial1TB/N400
 *
 * Rules (content-safety.md rule 3: no machine translation of civics content):
 * - Only entries WITHOUT the "{lang}_suggested" flag are imported. The flag marks text that
 *   the N400 project generated with an LLM and has not had reviewed. Those are only counted.
 *   Reverse this with INCLUDE_MACHINE_SUGGESTED, which is false and must stay false unless
 *   the project owner decides otherwise.
 * - The English question in N400 must equal the USCIS source question (loose comparison),
 *   or the script stops.
 * - For the 2025 set, N400 reuses 2008 translations where the wording lines up. A 2025
 *   translation is imported only when the 2008 question it was inherited from has the same
 *   English wording. Other cases are left out and listed as missing.
 * - Answers are paired line by line with the USCIS answer lines only when the N400 English
 *   answers equal them one to one. Otherwise only the question translation is stored.
 * - Nothing is translated or edited by this script.
 * - Every file carries needsHumanReview: true and where its text came from.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  parseTxt2025,
  parseHtml2008,
  VERSIONS,
  SOURCE_DIR,
  DYNAMIC_RE,
} from "../answer-key/build-answer-key.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const N400_DIR = process.env.N400_DIR ?? "/Volumes/Crucial1TB/N400";
const OUT_DIR = path.join(ROOT, "data/translations/civics");
const LOG_FILE = path.join(ROOT, "docs/decisions-log.md");

/** Never import machine-suggested text. See the header. */
const INCLUDE_MACHINE_SUGGESTED = false;

/** The 14 languages of the display layer. The 6 frame languages (ar ur gu fr bn uk) are left out. */
const LANGUAGES = ["en", "vi", "es", "zh", "tl", "ko", "hi", "ht", "th", "lo", "hmn", "my", "pt", "ru"];
const FOREIGN = LANGUAGES.filter((l) => l !== "en");

const loose = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
const pad3 = (n) => String(n).padStart(3, "0");
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------------------------------------------------------------------------
// Read the sources
// ---------------------------------------------------------------------------

const data = JSON.parse(fs.readFileSync(path.join(N400_DIR, "data.json"), "utf8"));
const n400Commit = execFileSync("git", ["-C", N400_DIR, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const SETS = {
  "2008": { n400: data.questions2008, parsed: parseHtml2008(path.join(SOURCE_DIR, VERSIONS["2008"].sourceFile)), expected: 100 },
  "2025": { n400: data.questions2025, parsed: parseTxt2025(path.join(SOURCE_DIR, VERSIONS["2025"].sourceFile)), expected: 128 },
};

const problems = [];
for (const [version, set] of Object.entries(SETS)) {
  if (set.parsed.questions.length !== set.expected) problems.push(`${version}: expected ${set.expected} USCIS questions`);
  if (set.n400.length !== set.expected) problems.push(`${version}: N400 has ${set.n400.length} questions, expected ${set.expected}`);
  for (const q of set.parsed.questions) {
    const n = set.n400.find((x) => x.id === q.number);
    if (!n) problems.push(`${version}-${pad3(q.number)}: not in N400`);
    else if (loose(n.q) !== loose(q.questionText)) {
      problems.push(`${version}-${pad3(q.number)}: English question differs. USCIS: "${q.questionText}" N400: "${n.q}"`);
    }
  }
}
if (problems.length > 0) {
  console.error("Stopped. The N400 English text does not line up with the USCIS source:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

const byId = (set) => new Map(set.n400.map((x) => [x.id, x]));
const n400By = { "2008": byId(SETS["2008"]), "2025": byId(SETS["2025"]) };

/** Static USCIS answer lines of a question, or null for dynamic questions. */
function usLines(q) {
  if (q.answers.some((a) => DYNAMIC_RE.test(a.text))) return null;
  return q.answers.map((a) => a.text);
}

/** True when N400's English answers equal the USCIS lines one to one. */
function englishAnswersAlign(n, lines) {
  return lines !== null && Array.isArray(n.a) && n.a.length === lines.length && n.a.every((x, i) => loose(x) === loose(lines[i]));
}

// ---------------------------------------------------------------------------
// English display files
// ---------------------------------------------------------------------------

const outputs = new Map(); // relative path -> object
const stats = []; // {version, lang, imported, withAnswers, missing: {reason: n}}

for (const [version, set] of Object.entries(SETS)) {
  const entries = {};
  for (const q of set.parsed.questions) {
    entries[`${version}-${pad3(q.number)}`] = { question: q.questionText, answers: usLines(q) };
  }
  outputs.set(`${version}/en.json`, {
    language: "en",
    testVersion: version,
    note: "Official English display text, taken line by line from the USCIS source file in data/sources/. Not used for scoring.",
    needsHumanReview: false,
    entries,
  });
}

// ---------------------------------------------------------------------------
// Translation files
// ---------------------------------------------------------------------------

function importLanguage(version, lang) {
  const set = SETS[version];
  const entries = {};
  const missing = {};
  let withAnswers = 0;

  for (const q of set.parsed.questions) {
    const id = `${version}-${pad3(q.number)}`;
    const n = n400By[version].get(q.number);
    const text = n[lang];
    const answers = n[`${lang}_a`];
    const lines = usLines(q);

    if (typeof text !== "string" || text.trim() === "") {
      missing[id] = "not-in-source";
      continue;
    }
    if (n[`${lang}_suggested`] === true && !INCLUDE_MACHINE_SUGGESTED) {
      missing[id] = "machine-suggested";
      continue;
    }

    let answersOk = Array.isArray(answers) && englishAnswersAlign(n, lines) && answers.length === lines.length;

    if (version === "2025") {
      // The 2025 bank reuses 2008 translations. Find the 2008 question this text came from.
      const sources = SETS["2008"].n400.filter((m) => m[lang] === text && m[`${lang}_suggested`] !== true);
      if (sources.length === 0) {
        missing[id] = "unverifiable-origin";
        continue;
      }
      const sameWording = sources.filter((m) => loose(m.q) === loose(n.q));
      if (sameWording.length === 0) {
        missing[id] = "inherited-wording-differs";
        continue;
      }
      // Answers must also come from a 2008 question with the same answers in English and in the language.
      answersOk =
        answersOk &&
        sameWording.some(
          (m) =>
            Array.isArray(m[`${lang}_a`]) &&
            sameList(m[`${lang}_a`], answers) &&
            Array.isArray(m.a) &&
            sameList(m.a.map(loose), n.a.map(loose))
        );
    }

    entries[id] = {
      question: text,
      answers: answersOk ? answers : null,
      status: "source",
    };
    if (answersOk) withAnswers += 1;
  }

  const meta = data.langMeta[lang];
  const missingCounts = {};
  for (const reason of Object.values(missing)) missingCounts[reason] = (missingCounts[reason] ?? 0) + 1;
  stats.push({ version, lang, imported: Object.keys(entries).length, withAnswers, missing: missingCounts, total: set.parsed.questions.length });

  return {
    language: lang,
    testVersion: version,
    needsHumanReview: true,
    note: "Display text for reference only. Not used for scoring. Status 'source' means the text was taken from the N400 project's data without an LLM-suggested flag; Language Lab has not reviewed it.",
    provenance: {
      repository: "N400 (read-only source)",
      commit: n400Commit,
      contentVersion: data.contentVersion,
      tier: meta.tier,
      endonym: meta.name,
    },
    entries,
    missing,
  };
}

for (const version of ["2008", "2025"]) {
  for (const lang of FOREIGN) outputs.set(`${version}/${lang}.json`, importLanguage(version, lang));
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function coverageMarkdown() {
  const lines = [];
  lines.push(`Generated by \`tools/translations/import-n400.mjs\` from N400 commit \`${n400Commit}\` (contentVersion \`${data.contentVersion}\`). Machine-suggested text is not imported.`);
  lines.push("");
  for (const version of ["2008", "2025"]) {
    const total = SETS[version].parsed.questions.length;
    lines.push(`**${version} set (${total} questions).** "Shown in language" counts questions with a translation. "With answers" counts those that also have the answer lines paired. The rest show English with the note "no translation yet".`);
    lines.push("");
    lines.push("| language | shown in language | with answers | machine-suggested (not imported) | inherited wording differs | unverifiable origin | not in source |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const lang of FOREIGN) {
      const s = stats.find((x) => x.version === version && x.lang === lang);
      const m = s.missing;
      lines.push(`| ${lang} | ${s.imported} of ${total} | ${s.withAnswers} | ${m["machine-suggested"] ?? 0} | ${m["inherited-wording-differs"] ?? 0} | ${m["unverifiable-origin"] ?? 0} | ${m["not-in-source"] ?? 0} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

console.log(coverageMarkdown());

if (process.argv.includes("--write")) {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  for (const [rel, obj] of outputs) {
    const file = path.join(OUT_DIR, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
  }
  console.log(`wrote ${outputs.size} files in data/translations/civics/`);

  const START = "<!-- coverage:start -->";
  const END = "<!-- coverage:end -->";
  if (fs.existsSync(LOG_FILE)) {
    const log = fs.readFileSync(LOG_FILE, "utf8");
    const a = log.indexOf(START);
    const b = log.indexOf(END);
    if (a !== -1 && b > a) {
      fs.writeFileSync(LOG_FILE, log.slice(0, a + START.length) + "\n" + coverageMarkdown() + "\n" + log.slice(b));
      console.log("updated the coverage table in docs/decisions-log.md");
    }
  }
}
