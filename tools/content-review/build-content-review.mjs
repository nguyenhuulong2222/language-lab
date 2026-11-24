#!/usr/bin/env node
/**
 * tools/content-review/build-content-review.mjs
 *
 * Writes docs/content-review.md: one short checklist per data file that is still marked
 * needsHumanReview: true (spec release-finish REQ-R01). Each line says what to check. It reads the
 * data only and changes no flag.
 *
 *   node --no-warnings tools/content-review/build-content-review.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const OUT = "docs/content-review.md";

/** Every JSON file under data/ marked needsHumanReview: true. */
function flaggedFiles(dir = "data") {
  const out = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== "sources") out.push(...flaggedFiles(rel));
    } else if (entry.name.endsWith(".json")) {
      try {
        if (read(rel).needsHumanReview === true) out.push(rel);
      } catch {
        // not a JSON object: not a content file
      }
    }
  }
  return out.sort();
}

const box = (text) => `- [ ] ${text}`;
const sections = [];
const answerText = (version, id) => {
  const key = read(`data/civics-answers/${version}.json`);
  return key.entries.find((e) => e.id === id)?.questionText ?? id;
};

const builders = {
  "data/practice/profiles.json": (d) => [
    "Check that each person is invented: the name is not a real, well-known or public person, and nothing else identifies anyone.",
    ...d.profiles.map((p) => box(`**${p.displayName}** (\`${p.id}\`): invented name, marked fictional.`)),
  ],
  "data/practice/n400-questions.json": (d) => {
    const names = Object.fromEntries(read("data/practice/profiles.json").profiles.map((p) => [p.id, p.displayName]));
    return [
      "For each question: the wording sounds like a real interview question, and each sample answer fits that fictional person only. No answer may read as advice on what a real applicant should say (content-safety rule 2).",
      ...d.questions.map(
        (q) =>
          `${box(`**${q.id}** "${q.text}"`)}\n` +
          Object.entries(q.sampleAnswers)
            .map(([id, a]) => `  - ${names[id] ?? id}: "${a}"`)
            .join("\n")
      ),
    ];
  },
  "data/practice/reading-sentences.json": (d) => [
    "Each sentence is short, natural English, true as a statement about civics, and uses only words of the official reading list (a test checks the words; you check the sense).",
    ...d.sentences.map((s) => box(`\`${s.id}\` "${s.text}"`)),
  ],
  "data/practice/writing-sentences.json": (d) => [
    "Each sentence is short, natural English, true, easy to say aloud for dictation, and uses only words of the official writing list.",
    ...d.sentences.map((s) => box(`\`${s.id}\` "${s.text}"`)),
  ],
  "data/practice/vocabulary.json": (d) => [
    "Compare the two word lists with the official PDFs in `data/sources/` (rev. 08/08). Look for a missing or extra word and a word in the wrong group.",
    ...["reading", "writing"].map((kind) =>
      box(
        `${kind === "reading" ? "Reading" : "Writing"} list (${Object.values(d[kind].categories).flat().length} entries in ` +
          `${Object.keys(d[kind].categories).length} groups: ${Object.keys(d[kind].categories).join(", ")}) against \`${path.basename(d[kind].sourceFile)}\`.`
      )
    ),
  ],
  "data/practice/practice-config.json": (d) => {
    const m = d.sentenceMatch;
    return [
      "These are Language Lab practice settings, not USCIS rules. Decide if each is fair for practice.",
      box(`Short words that may be missing or extra: ${m.functionWords.join(", ")}.`),
      box(`Words never shortened by the plural rule: ${m.neverStem.join(", ")}.`),
      box(`Words shorter than ${m.pluralMinLetters} letters get no plural variant.`),
      box(`Spelling slips (writing only): ${m.spellingSlips.map((s) => `${s.maxEdits} letter(s) from ${s.fromLetters} letters`).join("; ")}; shorter words must be exact.`),
      box(`Extra content words allowed: reading ${m.reading.extraContentWordsAllowed}, writing ${m.writing.extraContentWordsAllowed}.`),
      box("The wording of `scoringBasis` matches the USCIS Policy Manual passages it cites."),
    ];
  },
  "data/images/question-images.json": (d) => {
    const manifest = new Map(read("data/images/manifest.json").images.map((i) => [i.id, i]));
    return [
      "For each pairing: the picture shows what the question is about, and does not give the answer away in a misleading way. The picture appears only after the answer is graded and in Study first.",
      ...Object.entries(d.questions).map(([qid, pid]) => {
        const img = manifest.get(pid);
        return box(`\`${qid}\` "${answerText(qid.slice(0, 4), qid)}" → **${img?.title ?? pid}** (${img?.date ?? "no date"})`);
      }),
    ];
  },
};

const files = flaggedFiles();
for (const file of files) {
  const data = read(file);
  const build = builders[file];
  const lines = build ? build(data) : ["No checklist template for this file yet: read it against its `note`."];
  sections.push(`## \`${file}\`\n\n${lines.join("\n")}`);
}

// CON-13: picture records whose rights or creator need a person's look.
const unsure = read("data/images/manifest.json").images.filter(
  (i) =>
    /unknown/i.test(i.creator ?? "") ||
    /see |rights page|more information|further/i.test(i.rights ?? "") ||
    // The audit names this CC0 record as the most likely copyright question (a 1945 carbro print).
    /eisenhower/i.test(i.id)
);
sections.push(
  `## Picture records to check (audit CON-13)\n\n` +
    "Open the source page of each record and check the creator and the rights statement against the credits page (`docs/image-credits.md`).\n" +
    (unsure.length === 0
      ? "- No record has an unknown creator or a rights line that points elsewhere."
      : unsure.map((i) => box(`**${i.title}** (\`${i.id}\`): creator "${i.creator}"; rights "${i.rights}"; ${i.sourcePageUrl}`)).join("\n"))
);

const doc = `# Content waiting for review

<!-- Generated by tools/content-review/build-content-review.mjs. Do not edit by hand; run it again after a data change. -->

Every file below is still marked \`needsHumanReview: true\`. Tick each line once you have checked it.
When a whole file is done, record the review in that file: set \`needsHumanReview\` to \`false\` and add
\`reviewedBy\` (your name) and \`reviewedOn\` (YYYY-MM-DD). The app loads a file marked \`false\` only
with both fields (audit CON-06). Nothing here changes a flag.

Files: ${files.length}. Rough time: profiles 2 min, N-400 questions 5 min, sentences 6 min, vocabulary 5 min,
practice settings 4 min, picture pairings 8 min.

${sections.join("\n\n")}
`;
fs.writeFileSync(path.join(ROOT, OUT), doc);
console.log(`Wrote ${OUT} (${files.length} files).`);
