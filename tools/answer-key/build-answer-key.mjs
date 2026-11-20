#!/usr/bin/env node
/**
 * tools/answer-key/build-answer-key.mjs
 *
 * Builds data/civics-answers/2008.json and 2025.json from the official USCIS source files in
 * data/sources/, and writes the review sheet docs/answer-key-review.md.
 *
 *   node tools/answer-key/build-answer-key.mjs                 dry run: parse, check, report
 *   node tools/answer-key/build-answer-key.mjs --write=2008    write data/civics-answers/2008.json
 *   node tools/answer-key/build-answer-key.mjs --write=2025    write data/civics-answers/2025.json
 *   node tools/answer-key/build-answer-key.mjs --write=review  write docs/answer-key-review.md
 *
 * Rules this script follows:
 * - It never invents a question or an answer. Parsing is strict: any line it does not
 *   recognise, a missing or repeated question number, or a wrong total stops the build.
 * - Every place where the source text had to be interpreted is recorded as a flag on that
 *   question and listed in the review sheet.
 * - Files it writes always carry needsHumanReview: true. A person approves them, not this
 *   script.
 * - It uses the engine's own normaliser (src/engine/answer-normaliser.ts), so stored answers
 *   are in exactly the form the loader and grader expect.
 *
 * Needs Node 22.18 or newer (it imports the TypeScript normaliser directly).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { normalise, containsPhrase } from "../../src/engine/answer-normaliser.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SOURCE_DIR = path.join(ROOT, "data/sources");

const VERSIONS = {
  "2025": {
    expected: 128,
    kind: "txt",
    sourceFile: "uscis-2025-civics-128.txt",
    documentFile: "uscis-2025-civics-128.pdf",
    sourceUrl:
      "https://www.uscis.gov/sites/default/files/document/questions-and-answers/2025-Civics-Test-128-Questions-and-Answers.pdf",
    documentTitle: "128 Civics Questions and Answers (2025 version), M-1778 (09/25)",
    sourceDocument: (n) =>
      `128 Civics Questions and Answers (2025 version), M-1778 (09/25), uscis-2025-civics-128.pdf, question ${n}`,
    output: path.join(ROOT, "data/civics-answers/2025.json"),
  },
  "2008": {
    expected: 100,
    kind: "html",
    sourceFile: "uscis-2008-civics-100.html",
    documentFile: "uscis-2008-civics-100.html",
    crossCheckFile: "uscis-2008-civics-100-rev0119.txt",
    sourceUrl: "https://www.uscis.gov/civics-questions-and-answers-2008-version",
    documentTitle: "Civics Questions and Answers (2008 version), uscis.gov web page",
    sourceDocument: (n) =>
      `Civics Questions and Answers (2008 version), uscis.gov web page saved as uscis-2008-civics-100.html, question ${n}`,
    output: path.join(ROOT, "data/civics-answers/2008.json"),
  },
};

const REVIEW_SHEET = path.join(ROOT, "docs/answer-key-review.md");
const MARKERS_FILE = path.join(ROOT, "tools/answer-key/answer-markers.json");
const BATCH_SIZE = 20;
const MAX_VARIANTS_PER_LINE = 16;

/** A source answer line that makes the whole question dynamic. */
const DYNAMIC_RE = /answers will vary|uscis\.gov\/citizenship\/testupdates/i;

const NUMBER_WORDS =
  "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|" +
  "fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|" +
  "eighty|ninety|hundred|thousand|million|billion";
/** Spelled-out number followed by its numeral in parentheses: "Twenty-seven (27)". */
const NUMBER_PAIR = new RegExp(`((?:\\b(?:${NUMBER_WORDS})\\b[\\s-]*)+)\\((\\d+)\\)`, "gi");

const COUNT_WORDS = { two: 2, three: 3, four: 4, five: 5 };

const FLAGS = {
  DYNAMIC:
    "Marked dynamic: a source answer line says answers will vary or points to the test updates page. No answers are stored.",
  RAC: "requiredAnswerCount is above 1, read from the wording of the question (for example 'Name two').",
  COUNTWORD:
    "The question mentions a count (two, three, four, five) but asks for one answer, so requiredAnswerCount is 1. The answer is stored as written.",
  OPT: "Words in parentheses are optional in the source. Stored both with and without them.",
  ALTNAME:
    "A parenthetical on this source line was marked by the project owner as an alternative name, not optional words (see tools/answer-key/answer-markers.json). Each name is stored as its own answer.",
  OPTWORD:
    "The project owner decided that one word of this source line is optional (see tools/answer-key/answer-markers.json, optionalWords). Stored with and without it; both count as one answer.",
  ANYORDER:
    "The project owner decided that the items listed on this source line may be said in any order (see tools/answer-key/answer-markers.json, anyOrder). Every item is still required, and items of different lines are not mixed.",
  NUMALONE:
    "The bare number is accepted as the answer for this source line (decision recorded in tools/answer-key/answer-markers.json). Stored in numberAlone.",
  NUM: "A spelled-out number is followed by its numeral in parentheses. Stored as the words and as the numeral.",
  SLASH: "Alternatives written with a slash in the source were split into separate answers.",
  ALTS: "A parenthetical lists alternatives separated by commas. It is stored only as one optional phrase, not as separate alternatives.",
  ALSO: "A bracketed 'also acceptable' note in the source was added as extra accepted answers.",
  NOTE: "A note in the source that is not an answer (for example a pointer to a list of tribes) was dropped.",
  WRAP: "The question or an answer was split over several lines in the source and was joined.",
  LAYOUT:
    "In the source page's markup, answers or a note were outside the numbered list. They were attached to the question they follow, which matches the older official text.",
  REDUNDANT:
    "For a question that needs more than one answer, a longer variant that contains a shorter variant of the same answer was not stored. It could never match unless the shorter one matched too.",
  DUP: "Two source lines became the same answer after normalising. Stored once.",
  DIGITS:
    "An accepted answer contains digits. The matcher treats digits and spelled-out numbers as the same (13 = thirteen, 14th = fourteenth), so nothing was added to the data. A year read as two numbers (\"nineteen twenty\" for 1920) is not matched.",
  SENTENCE:
    "Every accepted answer is a sentence of five or more words. A response must contain the whole sentence.",
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const collapse = (s) => s.replace(/\s+/g, " ").trim();
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pad3 = (n) => String(n).padStart(3, "0");
const unique = (items) => [...new Set(items)];
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return String.fromCodePoint(code);
    }
    const named = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "\u2019", lsquo: "\u2018", ldquo: "\u201C", rdquo: "\u201D" };
    if (!(name.toLowerCase() in named)) throw new Error(`Unknown HTML entity ${whole}`);
    return named[name.toLowerCase()];
  });
}

/** Remove the 65/20 asterisk marker from the end of a question. Returns [text, hadMarker]. */
function stripMarker(text) {
  const match = /\s*\*\s*$/.exec(text);
  return match ? [text.slice(0, match.index).trim(), true] : [text.trim(), false];
}

// ---------------------------------------------------------------------------
// Parsing the 2025 text file
// ---------------------------------------------------------------------------

function parseTxt2025(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const questions = [];
  const problems = [];
  let started = false;
  let current = null;
  let state = "none"; // "question" | "answer"

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (!started) {
      if (/^\s*AMERICAN GOVERNMENT\s*$/.test(line)) started = true;
      return;
    }
    if (line.trim() === "") return;
    if (/^\s*\d+ of \d+\s+uscis\.gov\/citizenship\s*$/.test(line)) return; // page footer
    if (/^\s*(AMERICAN GOVERNMENT|AMERICAN HISTORY|SYMBOLS AND HOLIDAYS)\s*$/.test(line)) return;
    if (/^\s*[A-C]: \S.*$/.test(line)) return; // sub-section heading

    const bullet = /^\s*\u2022\s+(\S.*)$/.exec(line);
    if (bullet) {
      if (!current) return problems.push(`L${lineNo}: answer line before any question`);
      current.answers.push({ text: collapse(bullet[1]), lines: [lineNo] });
      state = "answer";
      return;
    }

    const start = /^\s*(\d+)\.\s+(\S.*)$/.exec(line);
    if (start) {
      current = { number: Number(start[1]), questionParts: [collapse(start[2])], questionLines: [lineNo], answers: [], notes: [] };
      questions.push(current);
      state = "question";
      return;
    }

    // Anything else is a continuation or a known note. Never guess.
    if (current && state === "question") {
      current.questionParts.push(collapse(line));
      current.questionLines.push(lineNo);
      return;
    }
    if (current && state === "answer") {
      if (/^\s*For a complete list of tribes, please visit bia\.gov\.\s*$/.test(line)) {
        current.notes.push({ text: collapse(line), line: lineNo });
        return;
      }
      const last = current.answers[current.answers.length - 1];
      last.text = collapse(`${last.text} ${line}`);
      last.lines.push(lineNo);
      return;
    }
    problems.push(`L${lineNo}: unrecognised line: ${JSON.stringify(line.trim().slice(0, 80))}`);
  });

  for (const q of questions) {
    const joined = collapse(q.questionParts.join(" "));
    const [text, marker] = stripMarker(joined);
    q.questionText = text;
    q.asterisk = marker;
    q.wrapped = q.questionLines.length > 1 || q.answers.some((a) => a.lines.length > 1);
    q.sourceRef = `${path.basename(file)} L${q.questionLines[0]}`;
    for (const a of q.answers) {
      a.display = `L${a.lines[0]}${a.lines.length > 1 ? `\u2013${a.lines[a.lines.length - 1]}` : ""}: \u2022 ${a.text}`;
    }
  }
  return { questions, problems };
}

// ---------------------------------------------------------------------------
// Parsing the 2008 web page
// ---------------------------------------------------------------------------

function parseHtml2008(file) {
  const html = fs.readFileSync(file, "utf8");
  const begin = html.indexOf("<strong>AMERICAN GOVERNMENT</strong>");
  const end = html.indexOf("If you are 65 years old or older", begin);
  if (begin < 0 || end < 0) throw new Error("Could not find the question list in the 2008 web page.");
  let region = html.slice(begin, end);

  const questions = [];
  const problems = [];
  const lists = [];
  const layoutByQuestion = new Map();
  const orphanNotes = new Map();

  // Layout quirk 1: a question whose answers sit in a separate list after the numbered list,
  // with a bracketed note between them (question 87, American Indian tribes).
  region = region.replace(
    /<li>([^<]*)<\/li><\/ol><p>(\[[^\]]*\])<\/p><ul><li>(?:&nbsp;|\s)*<ul>((?:<li>[^<]*<\/li>)*)<\/ul><\/li><\/ul>/g,
    (whole, question, note, answers) => {
      const key = collapse(decodeEntities(question));
      layoutByQuestion.set(key, "answers and note were outside the numbered list in the page markup; attached to the question they follow");
      orphanNotes.set(key, collapse(decodeEntities(note)));
      return `<li>${question}<ul>${answers}</ul></li></ol>`;
    }
  );

  // Layout quirk 2: a bracketed note in its own paragraph right after a numbered list
  // (question 95, Statue of Liberty). It is appended to the last answer line, which is where
  // the older official text prints it.
  region = region.replace(
    /<li>([^<]*)<\/li><\/ul><\/li><\/ol><p>(\[[^\]]*\])<\/p>/g,
    (whole, lastAnswer, note) => {
      layoutByQuestion.set(`ANSWER:${collapse(decodeEntities(lastAnswer))}`, "bracketed note was a separate paragraph after the numbered list; appended to the last answer line");
      return `<li>${lastAnswer} ${note}</li></ul></li></ol>`;
    }
  );
  const olRe = /<ol(?:\s+start="(\d+)")?>([\s\S]*?)<\/ol>/g;
  let ol;
  while ((ol = olRe.exec(region))) {
    const start = ol[1] ? Number(ol[1]) : 1;
    const body = ol[2];
    const liRe = /<li>([^<]*)<ul>((?:<li>[^<]*<\/li>)*)<\/ul><\/li>/g;
    let item;
    let consumed = 0;
    let n = start;
    let count = 0;
    while ((item = liRe.exec(body))) {
      if (item.index !== consumed) {
        problems.push(`list starting at ${start}: unexpected markup: ${JSON.stringify(body.slice(consumed, item.index).slice(0, 80))}`);
      }
      consumed = liRe.lastIndex;
      const answers = [...item[2].matchAll(/<li>([^<]*)<\/li>/g)].map((m, k) => ({
        text: collapse(decodeEntities(m[1])),
        display: `\u2022 ${collapse(decodeEntities(m[1]))}`,
        lines: [k + 1],
      }));
      const [text, marker] = stripMarker(collapse(decodeEntities(item[1])));
      const lastAnswer = answers[answers.length - 1];
      const noteAfterAnswer = lastAnswer
        ? [...layoutByQuestion.keys()].find(
            (key) => key.startsWith("ANSWER:") && lastAnswer.text.startsWith(key.slice("ANSWER:".length) + " [")
          )
        : undefined;
      const layout = layoutByQuestion.get(text) ?? (noteAfterAnswer ? layoutByQuestion.get(noteAfterAnswer) : undefined);
      questions.push({
        number: n,
        questionText: text,
        asterisk: marker,
        wrapped: false,
        layout,
        answers,
        notes: orphanNotes.has(text) ? [{ text: orphanNotes.get(text), line: null }] : [],
        sourceRef: `${path.basename(file)} list ${lists.length + 1}, item ${count + 1}`,
      });
      n += 1;
      count += 1;
    }
    if (consumed !== body.length) {
      problems.push(`list starting at ${start}: unparsed markup: ${JSON.stringify(body.slice(consumed).slice(0, 80))}`);
    }
    lists.push({ start, count });
  }
  // Lists must run on from one another without a gap or overlap.
  for (let i = 1; i < lists.length; i++) {
    const expectedStart = lists[i - 1].start + lists[i - 1].count;
    if (lists[i].start !== expectedStart) {
      problems.push(`list ${i + 1} starts at ${lists[i].start} but the previous list ended at ${expectedStart - 1}`);
    }
  }
  return { questions, problems };
}

/** The older rev. 01/19 text of the 2008 list: explicit numbers, used only as a cross-check. */
function parseTxt2008Rev0119(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const questions = [];
  let started = false;
  let current = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!started) {
      if (line === "AMERICAN GOVERNMENT") started = true;
      continue;
    }
    if (line === "" || /^[A-C]: /.test(line) || /^(AMERICAN GOVERNMENT|AMERICAN HISTORY|INTEGRATED CIVICS)$/.test(line)) continue;
    const q = /^(\d+)\.\s+(.*)$/.exec(line);
    if (q) {
      const [text, marker] = stripMarker(collapse(q[2]));
      current = { number: Number(q[1]), questionText: text, asterisk: marker, answers: [] };
      questions.push(current);
      continue;
    }
    const a = /^\.\s+(.*)$/.exec(line);
    if (a && current) {
      current.answers.push({ text: collapse(a[1]) });
      continue;
    }
    if (line.startsWith("* If you are 65")) continue;
    if (current && !/^\.\s/.test(line)) {
      // A wrapped line: attach to the previous answer or question.
      if (current.answers.length) current.answers[current.answers.length - 1].text += ` ${collapse(line)}`;
      else current.questionText += ` ${collapse(line)}`;
    }
  }
  return questions;
}

// ---------------------------------------------------------------------------
// Numbering checks
// ---------------------------------------------------------------------------

function checkNumbering(questions, expected) {
  const seen = new Map();
  for (const q of questions) seen.set(q.number, (seen.get(q.number) ?? 0) + 1);
  const duplicates = [...seen].filter(([, count]) => count > 1).map(([n]) => n);
  const missing = [];
  for (let n = 1; n <= expected; n++) if (!seen.has(n)) missing.push(n);
  const outside = [...seen.keys()].filter((n) => n < 1 || n > expected);
  const outOfOrder = [];
  for (let i = 1; i < questions.length; i++) {
    if (questions[i].number !== questions[i - 1].number + 1) outOfOrder.push(`${questions[i - 1].number} -> ${questions[i].number}`);
  }
  return {
    count: questions.length,
    expected,
    duplicates,
    missing,
    outside,
    outOfOrder,
    ok:
      questions.length === expected &&
      !duplicates.length &&
      !missing.length &&
      !outside.length &&
      !outOfOrder.length,
  };
}

// ---------------------------------------------------------------------------
// Turning one source answer line into accepted answers
// ---------------------------------------------------------------------------

/**
 * Expand one source line into normalised accepted answers.
 *   [Also acceptable are A, B, and C.]  -> A, B and C become extra answers
 *   [any other bracketed note]          -> dropped
 *   Twenty-seven (27)                   -> "twenty seven" and "27"
 *   A/B                                 -> A and B
 *   (optional words)                    -> with and without
 */
function expandLine(raw, { allowBrackets = true, markers = [], optionalWords = [] } = {}) {
  const flags = new Set();
  const notes = [];
  const extras = [];
  let alternative = false;
  let oneAnswer = false;
  let text = collapse(raw);

  if (allowBrackets) {
    text = text.replace(/\[([^\]]*)\]/g, (whole, inner) => {
      const also = /^Also acceptable are (.+?)\.?$/i.exec(collapse(inner));
      if (also) {
        const items = also[1].replace(/,\s*and\s+/g, ", ").split(/,\s*/).map((s) => s.trim().replace(/\.$/, "")).filter(Boolean);
        extras.push(...items);
        flags.add("ALSO");
        notes.push(`added from "${collapse(whole)}": ${items.join("; ")}`);
      } else {
        flags.add("NOTE");
        notes.push(`dropped note: ${collapse(whole)}`);
      }
      return " ";
    });
  }

  const choices = [];
  const hold = (options) => {
    choices.push(options);
    return `\u0001${choices.length - 1}\u0001`;
  };
  text = text.replace(NUMBER_PAIR, (_, words, digits) => {
    flags.add("NUM");
    return hold([words.trim(), digits]);
  });
  text = text.replace(/\b([A-Za-z]+)\/([A-Za-z]+)\b/g, (_, a, b) => {
    flags.add("SLASH");
    return hold([a, b]);
  });
  // Owner decisions: one word of the line is optional ("Jr.", "Day"). The variants are one answer.
  for (const optional of optionalWords) {
    const pattern = new RegExp(`(?<![A-Za-z])${escapeRegExp(optional.word)}(?![A-Za-z])`, "g");
    const found = text.match(pattern) ?? [];
    if (found.length !== 1) {
      throw new Error(`Optional word for ${optional.question} ("${optional.word}") matched ${found.length} times in: ${raw}`);
    }
    text = text.replace(pattern, () => hold(["", optional.word]));
    flags.add("OPTWORD");
    oneAnswer = true;
    notes.push(`optional word (owner decision): "${optional.word}" in "${collapse(raw)}" may be left out; both forms count as one answer`);
  }
  // Owner decisions for single parenthetical groups: "alternative" instead of "optional".
  // Done before the general rule below, so only the marked group changes.
  for (const marker of markers) {
    const pattern = new RegExp(`${escapeRegExp(marker.replaces)}\\s*${escapeRegExp(marker.group)}`, "g");
    const found = text.match(pattern) ?? [];
    if (found.length !== 1) {
      throw new Error(
        `Marker for ${marker.question} ("${marker.replaces} ${marker.group}") matched ${found.length} times in: ${raw}`
      );
    }
    const items =
      marker.items ??
      marker.group
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    text = text.replace(pattern, () => hold([marker.replaces, ...items]));
    flags.add("ALTNAME");
    alternative = true;
    notes.push(
      `alternative name (owner decision): "${collapse(raw)}" is stored as ${[marker.replaces, ...items]
        .map((item) => `"${collapse(raw).replace(new RegExp(`${escapeRegExp(marker.replaces)}\\s*${escapeRegExp(marker.group)}`), item)}"`)
        .join(" and ")}`
    );
  }

  text = text.replace(/\(([^()]*)\)/g, (_, inner) => {
    flags.add("OPT");
    if (inner.includes(",")) flags.add("ALTS");
    return hold(["", inner]);
  });
  if (/[()[\]]/.test(text.replace(/\u0001\d+\u0001/g, ""))) {
    throw new Error(`Nested or unbalanced brackets in source line: ${raw}`);
  }

  let variants = [text];
  for (let id = 0; id < choices.length; id++) {
    const marker = `\u0001${id}\u0001`;
    variants = variants.flatMap((v) => choices[id].map((c) => v.replace(marker, c)));
  }
  if (variants.length > MAX_VARIANTS_PER_LINE) {
    throw new Error(`Too many variants (${variants.length}) for source line: ${raw}`);
  }

  let normalised = unique(variants.map(normalise).filter((v) => v.length > 0));
  const own = { variants: normalised, flags, notes, alternative, oneAnswer };
  const extraResults = extras.map((item) => expandLine(item, { allowBrackets: false }));
  return { ...own, extras: extraResults };
}

// ---------------------------------------------------------------------------
// Building one entry
// ---------------------------------------------------------------------------

/**
 * How many different answers the question asks for. Only the asking sentence counts:
 * "Name two ...", "What are three ..." at the start of the question or of a sentence.
 * A count word elsewhere ("There are four amendments... Describe one of them.") does not.
 */
function requiredCountFor(questionText) {
  const match = /(?:^|[.?!]\s+)(?:name|what are)\s+(two|three|four|five)\b/i.exec(questionText);
  return match ? COUNT_WORDS[match[1].toLowerCase()] : 1;
}

function buildEntry(version, config, q, markers = []) {
  const flags = new Set();
  const notes = [];
  const id = `${version}-${pad3(q.number)}`;
  const questionMarkers = markers.filter((m) => m.question === id && m.parentheses === "alternative");
  const questionNumberAlone = markers.filter((m) => m.question === id && m.numberAlone === true);
  const questionOptionalWords = markers.filter((m) => m.question === id && m.optionalWord === true);
  const questionAnyOrder = markers.filter((m) => m.question === id && m.anyOrder === true);
  const anyOrderLines = []; // { answers: variants of the line, items: variants of each item }
  const answerGroupSources = []; // variants of each line with an alternative marker (one answer)
  const numberAloneSources = []; // variants of each line marked numberAlone

  if (q.answers.length === 0) throw new Error(`${id}: question has no answer lines`);
  if (q.wrapped) flags.add("WRAP");
  if (q.layout) {
    flags.add("LAYOUT");
    notes.push(`layout: ${q.layout}`);
  }
  for (const note of q.notes) {
    flags.add("NOTE");
    notes.push(`dropped note${note.line ? ` (L${note.line})` : ""}: ${note.text}`);
  }

  const dynamicLines = q.answers.filter((a) => DYNAMIC_RE.test(a.text));
  const isDynamic = dynamicLines.length > 0;
  if (isDynamic && dynamicLines.length !== q.answers.length) {
    throw new Error(`${id}: some answer lines are dynamic and some are not. Check the source.`);
  }

  const count = requiredCountFor(q.questionText);
  if (count > 1) flags.add("RAC");
  else if (/\b(two|three|four|five)\b/i.test(q.questionText)) flags.add("COUNTWORD");

  let accepted = [];
  let answerGroups = [];
  let numberAlone = [];
  let anyOrder = [];
  const sourceLines = q.answers.map((a) => a.display);
  let requiredAnswerCount = 1;

  if (isDynamic) {
    flags.add("DYNAMIC");
  } else {
    requiredAnswerCount = count;
    const groups = []; // variants per source line, for the redundancy rule
    for (const answer of q.answers) {
      const lineMarkers = questionMarkers.filter((m) => collapse(m.line) === collapse(answer.text));
      for (const m of lineMarkers) m.used = true;
      const lineOptional = questionOptionalWords.filter((m) => collapse(m.line) === collapse(answer.text));
      for (const m of lineOptional) m.used = true;
      const expanded = expandLine(answer.text, { markers: lineMarkers, optionalWords: lineOptional });
      for (const f of expanded.flags) flags.add(f);
      notes.push(...expanded.notes);
      const lineGroups = [expanded, ...expanded.extras];
      for (const extra of expanded.extras) for (const f of extra.flags) flags.add(f);
      for (const g of lineGroups) groups.push(g.variants);
      if (expanded.alternative || expanded.oneAnswer) answerGroupSources.push(unique(lineGroups.flatMap((g) => g.variants)));
      for (const m of questionAnyOrder.filter((x) => collapse(x.line) === collapse(answer.text))) {
        m.used = true;
        const separator = String.raw`\s*(?:,\s*(?:and\s+)?|\s+and\s+)`;
        const shape = new RegExp(`^\\s*${m.items.map(escapeRegExp).join(separator)}\\s*$`);
        if (!shape.test(answer.text)) {
          throw new Error(`${id}: anyOrder items ${JSON.stringify(m.items)} are not the items of the source line "${answer.text}" in order`);
        }
        const items = m.items.map((item) => expandLine(item, { allowBrackets: false }).variants);
        anyOrderLines.push({ answers: unique(lineGroups.flatMap((g) => g.variants)), items });
        flags.add("ANYORDER");
        notes.push(`any order (owner decision): ${m.items.map((i) => `"${i}"`).join(", ")} may be said in any order; all are required`);
      }
      const aloneMarkers = questionNumberAlone.filter((m) => collapse(m.line) === collapse(answer.text));
      for (const m of aloneMarkers) m.used = true;
      if (aloneMarkers.length > 0) {
        flags.add("NUMALONE");
        numberAloneSources.push(unique(lineGroups.flatMap((g) => g.variants)));
        notes.push(`bare number accepted (owner decision): ${collapse(answer.text)}`);
      }
      if (expanded.variants.some((v) => /\d/.test(v)) && !expanded.flags.has("NUM")) flags.add("DIGITS");
      else if (expanded.extras.some((e) => e.variants.some((v) => /\d/.test(v)))) flags.add("DIGITS");
    }

    // For questions that need several answers, drop a variant that contains another variant
    // of the same source line: it can never match without the shorter one matching too.
    const kept = [];
    for (const variants of groups) {
      for (const v of variants) {
        const redundant =
          requiredAnswerCount > 1 && variants.some((w) => w !== v && containsPhrase(v, w));
        if (redundant) {
          flags.add("REDUNDANT");
          notes.push(`not stored (contains a shorter variant of the same answer): ${v}`);
        } else {
          kept.push(v);
        }
      }
    }
    const deduped = unique(kept);
    if (deduped.length < kept.length) flags.add("DUP");
    accepted = deduped;
    // Only stored answers can be members. A group needs two or more.
    answerGroups = answerGroupSources
      .map((vs) => vs.filter((v) => accepted.includes(v)))
      .filter((vs) => vs.length >= 2);
    numberAlone = unique(numberAloneSources.flat().filter((v) => accepted.includes(v)));
    anyOrder = anyOrderLines.map((line) => ({ answers: line.answers.filter((v) => accepted.includes(v)), items: line.items }));
    if (anyOrder.some((line) => line.answers.length === 0)) throw new Error(`${id}: an anyOrder line has no stored answer`);
    if (anyOrder.length > 0 && requiredAnswerCount > 1) throw new Error(`${id}: anyOrder is only supported where one answer is needed`);

    if (accepted.length === 0) throw new Error(`${id}: no accepted answers after parsing`);
    if (requiredAnswerCount > accepted.length) {
      throw new Error(`${id}: needs ${requiredAnswerCount} answers but only ${accepted.length} are accepted`);
    }
    if (accepted.every((a) => a.split(" ").length >= 5)) flags.add("SENTENCE");
  }

  return {
    number: q.number,
    id,
    questionText: q.questionText,
    answerType: isDynamic ? "dynamic" : "static",
    acceptedAnswers: accepted,
    requiredAnswerCount,
    sourceLines,
    sourceRef: q.sourceRef,
    flags,
    notes,
    json: {
      id,
      testVersion: version,
      questionText: q.questionText,
      acceptedAnswers: accepted,
      ...(answerGroups.length > 0 ? { answerGroups } : {}),
      ...(numberAlone.length > 0 ? { numberAlone } : {}),
      ...(anyOrder.length > 0 ? { anyOrder } : {}),
      requiredAnswerCount,
      answerType: isDynamic ? "dynamic" : "static",
      sourceUrl: config.sourceUrl,
      sourceDocument:
        config.sourceDocument(q.number) +
        (isDynamic
          ? /answers will vary/i.test(dynamicLines[0].text)
            ? " (USCIS text: answers will vary)"
            : " (USCIS text refers to the test updates page)"
          : ""),
    },
  };
}

/** Answers of one question that contain each other, for questions that need several answers. */
/** Read and validate the owner's per-answer markers. */
function loadMarkers() {
  const raw = JSON.parse(fs.readFileSync(MARKERS_FILE, "utf8"));
  if (!Array.isArray(raw.markers)) throw new Error("answer-markers.json: 'markers' must be an array");
  const alternatives = raw.markers.map((m, i) => {
    const where = `answer-markers.json, marker ${i + 1}`;
    for (const key of ["question", "line", "group", "parentheses", "replaces", "decision"]) {
      if (typeof m[key] !== "string" || m[key].trim() === "") throw new Error(`${where}: '${key}' must be a non-empty string`);
    }
    if (m.parentheses !== "alternative") throw new Error(`${where}: 'parentheses' must be "alternative"`);
    if (!/^\(.+\)$/.test(m.group)) throw new Error(`${where}: 'group' must be one parenthetical like "(Defense)"`);
    if (!new RegExp(`${escapeRegExp(m.replaces)}\\s*${escapeRegExp(m.group)}`).test(m.line)) {
      throw new Error(`${where}: 'replaces' must sit directly before 'group' in 'line'`);
    }
    if (m.items !== undefined && !(Array.isArray(m.items) && m.items.length > 0 && m.items.every((x) => typeof x === "string" && x.trim() !== ""))) {
      throw new Error(`${where}: 'items' must be a non-empty array of strings`);
    }
    if (!/^(2008|2025)-\d{3}$/.test(m.question)) throw new Error(`${where}: 'question' must look like 2025-048`);
    return { ...m, used: false };
  });
  const numberAlone = (raw.numberAlone ?? []).map((m, i) => {
    const where = `answer-markers.json, numberAlone ${i + 1}`;
    for (const key of ["question", "line", "decision"]) {
      if (typeof m[key] !== "string" || m[key].trim() === "") throw new Error(`${where}: '${key}' must be a non-empty string`);
    }
    if (!/^(2008|2025)-\d{3}$/.test(m.question)) throw new Error(`${where}: 'question' must look like 2025-097`);
    return { question: m.question, line: m.line, decision: m.decision, numberAlone: true, used: false };
  });
  const optionalWords = (raw.optionalWords ?? []).map((m, i) => {
    const where = `answer-markers.json, optionalWords ${i + 1}`;
    for (const key of ["question", "line", "word", "decision"]) {
      if (typeof m[key] !== "string" || m[key].trim() === "") throw new Error(`${where}: '${key}' must be a non-empty string`);
    }
    if (!/^(2008|2025)-\d{3}$/.test(m.question)) throw new Error(`${where}: 'question' must look like 2025-126`);
    if (!m.line.includes(m.word)) throw new Error(`${where}: 'word' must be a word of 'line'`);
    return { question: m.question, line: m.line, word: m.word, decision: m.decision, optionalWord: true, used: false };
  });
  const anyOrder = (raw.anyOrder ?? []).map((m, i) => {
    const where = `answer-markers.json, anyOrder ${i + 1}`;
    for (const key of ["question", "line", "decision"]) {
      if (typeof m[key] !== "string" || m[key].trim() === "") throw new Error(`${where}: '${key}' must be a non-empty string`);
    }
    if (!/^(2008|2025)-\d{3}$/.test(m.question)) throw new Error(`${where}: 'question' must look like 2025-016`);
    if (!Array.isArray(m.items) || m.items.length < 2 || !m.items.every((x) => typeof x === "string" && m.line.includes(x))) {
      throw new Error(`${where}: 'items' must be two or more parts of 'line'`);
    }
    return { question: m.question, line: m.line, items: m.items, decision: m.decision, anyOrder: true, used: false };
  });
  return [...alternatives, ...numberAlone, ...optionalWords, ...anyOrder];
}

function nestingProblems(entry) {
  if (entry.requiredAnswerCount <= 1) return [];
  const found = [];
  for (const a of entry.acceptedAnswers) {
    for (const b of entry.acceptedAnswers) {
      if (a !== b && containsPhrase(b, a)) found.push(`${entry.id}: "${a}" is inside "${b}"`);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Cross-check of the 2008 web page against the older text
// ---------------------------------------------------------------------------

const loose = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function compareWithRev0119(web, old) {
  const differences = [];
  const oldByNumber = new Map(old.map((q) => [q.number, q]));
  if (old.length !== web.length) differences.push(`question count differs: web page ${web.length}, rev. 01/19 ${old.length}`);
  for (const q of web) {
    const o = oldByNumber.get(q.number);
    if (!o) {
      differences.push(`${q.number}: not in rev. 01/19`);
      continue;
    }
    if (loose(q.questionText) !== loose(o.questionText)) {
      differences.push(`${q.number}: question wording differs. Web page: "${q.questionText}" / rev. 01/19: "${o.questionText}"`);
    }
    const a = q.answers.map((x) => loose(x.text)).sort();
    const b = o.answers.map((x) => loose(x.text)).sort();
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      const onlyWeb = q.answers.filter((x) => !b.includes(loose(x.text))).map((x) => x.text);
      const onlyOld = o.answers.filter((x) => !a.includes(loose(x.text))).map((x) => x.text);
      differences.push(
        `${q.number}: answers differ.` +
          (onlyWeb.length ? ` Only on the web page: ${onlyWeb.map((t) => `"${t}"`).join(", ")}.` : "") +
          (onlyOld.length ? ` Only in rev. 01/19: ${onlyOld.map((t) => `"${t}"`).join(", ")}.` : "")
      );
    }
  }
  return differences;
}

// ---------------------------------------------------------------------------
// Output: JSON
// ---------------------------------------------------------------------------

function entryJson(e) {
  const j = e.json;
  const q = (s) => JSON.stringify(s);
  return [
    "    {",
    `      "id": ${q(j.id)},`,
    `      "testVersion": ${q(j.testVersion)},`,
    `      "questionText": ${q(j.questionText)},`,
    `      "acceptedAnswers": [${j.acceptedAnswers.map(q).join(", ")}],`,
    ...(j.answerGroups ? [`      "answerGroups": [${j.answerGroups.map((g) => `[${g.map(q).join(", ")}]`).join(", ")}],`] : []),
    ...(j.numberAlone ? [`      "numberAlone": [${j.numberAlone.map(q).join(", ")}],`] : []),
    ...(j.anyOrder
      ? [`      "anyOrder": [${j.anyOrder.map((l) => `{ "answers": [${l.answers.map(q).join(", ")}], "items": [${l.items.map((it) => `[${it.map(q).join(", ")}]`).join(", ")}] }`).join(", ")}],`]
      : []),
    `      "requiredAnswerCount": ${j.requiredAnswerCount},`,
    `      "answerType": ${q(j.answerType)},`,
    `      "sourceUrl": ${q(j.sourceUrl)},`,
    `      "sourceDocument": ${q(j.sourceDocument)}`,
    "    }",
  ].join("\n");
}

function fileJson(version, config, entries) {
  const sources = [config.sourceFile, config.documentFile, config.crossCheckFile]
    .filter(Boolean)
    .filter((f, i, all) => all.indexOf(f) === i)
    .map((f) => ({ file: `data/sources/${f}`, sha256: sha256(path.join(SOURCE_DIR, f)) }));
  const note =
    version === "2025"
      ? "Built from data/sources/uscis-2025-civics-128.txt, converted from uscis-2025-civics-128.pdf (official USCIS 128 Civics Questions and Answers, 2025 version, M-1778 09/25), by tools/answer-key/build-answer-key.mjs. NEEDS HUMAN REVIEW: see docs/answer-key-review.md. Accepted answers are stored normalised (lowercase, no punctuation, hyphens as spaces). A leading the/a/an is optional when matching, so it is stored as written. Dynamic questions (answers change with elections, appointments or where the user lives) have no stored answers."
      : "Built from data/sources/uscis-2008-civics-100.html (official USCIS 2008 list, web page) by tools/answer-key/build-answer-key.mjs. Numbering was cross-checked against data/sources/uscis-2008-civics-100-rev0119.txt. NEEDS HUMAN REVIEW: see docs/answer-key-review.md. Accepted answers are stored normalised (lowercase, no punctuation, hyphens as spaces). A leading the/a/an is optional when matching, so it is stored as written. Dynamic questions (answers change with elections, appointments or where the user lives) have no stored answers.";
  return [
    "{",
    `  "_note": ${JSON.stringify(note)},`,
    `  "_generatedBy": "tools/answer-key/build-answer-key.mjs",`,
    `  "_reviewSheet": "docs/answer-key-review.md",`,
    `  "_sources": ${JSON.stringify(sources)},`,
    `  "needsHumanReview": true,`,
    `  "entries": [`,
    entries.map(entryJson).join(",\n"),
    "  ]",
    "}",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Output: review sheet
// ---------------------------------------------------------------------------

const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

function flagCodes(entry) {
  return [...entry.flags].filter((f) => f !== "DYNAMIC").join(", ");
}

function reviewTable(entries) {
  const rows = [
    "| id | question | accepted answers | answerType | source line | flags |",
    "|---|---|---|---|---|---|",
  ];
  for (const e of entries) {
    const answers = e.acceptedAnswers.length
      ? e.acceptedAnswers.map((a) => `\`${a}\``).join("<br>") + (e.requiredAnswerCount > 1 ? `<br>(needs ${e.requiredAnswerCount})` : "") +
        (e.json.answerGroups ? e.json.answerGroups.map((g) => `<br>(count as one: ${g.map((a) => `\`${a}\``).join(" / ")})`).join("") : "") +
        (e.json.numberAlone ? `<br>(bare number accepted: ${e.json.numberAlone.map((a) => `\`${a}\``).join(", ")})` : "") +
        (e.json.anyOrder ? e.json.anyOrder.map((l) => `<br>(any order, all required: ${l.items.map((it) => it.map((a) => `\`${a}\``).join(" / ")).join(" + ")})`).join("") : "")
      : "(none stored)";
    const source = e.sourceLines.map(cell).join("<br>") + (e.notes.length ? "<br>" + e.notes.map((n) => `<em>${cell(n)}</em>`).join("<br>") : "");
    rows.push(
      `| ${e.id} | ${cell(e.questionText)} | ${answers} | ${e.answerType} | ${source} | ${flagCodes(e) || ""} |`
    );
  }
  return rows.join("\n");
}

function reviewSheet(results, comparison) {
  const out = [];
  out.push("# Answer key review sheet", "");
  out.push(
    "Generated by `tools/answer-key/build-answer-key.mjs`. Do not edit by hand: change the script or the source files and run it again.",
    "",
    "Both answer key files are marked `needsHumanReview: true`. They stay that way until the project owner approves them.",
    "Source files are in `data/sources/` (see the README there).",
    ""
  );

  out.push("## Totals", "", "| Test | Questions found | Expected | Numbers 1 to N complete | Missing | Repeated | Static | Dynamic |", "|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const staticCount = r.entries.filter((e) => e.answerType === "static").length;
    out.push(
      `| ${r.version} | ${r.numbering.count} | ${r.numbering.expected} | ${r.numbering.ok ? "yes" : "NO"} | ${r.numbering.missing.join(", ") || "none"} | ${r.numbering.duplicates.join(", ") || "none"} | ${staticCount} | ${r.entries.length - staticCount} |`
    );
  }
  out.push("");

  out.push("## How to read this sheet", "");
  out.push(
    "- **accepted answers** are stored in normalised form: lowercase, no punctuation, hyphens as spaces. A leading `the`, `a` or `an` is optional when matching, so `the constitution` also matches `constitution`.",
    "- **needs N** means the question asks for that many different answers.",
    "- **source line** shows the answer lines exactly as in the source (2025 lines carry their line number in the `.txt` file). Italic text under them is a note about what was done.",
    "- **flags** list every place where the source text had to be interpreted. The codes are explained below.",
    "- Cleanups that involve no judgement: the trailing `*` that marks the 65/20 questions was removed from question text, page footers and section headings were skipped, bullets were removed, and whitespace was collapsed.",
    ""
  );

  out.push("## What literal matching means for reviewers", "");
  out.push(
    "A response is correct when it contains enough of the stored answers as whole words. Answers are the ones the source lists; nothing was added from outside it. So:",
    "",
    "- Numbers are matched by value, by the matcher, not by extra data: `13` = `thirteen`, `27` = `twenty-seven`, `14th` = `fourteenth`. For an answer that is a number with a unit (`six years`), the number alone (`six`, `6`) is also accepted. Questions with digits carry the **DIGITS** flag.",
    "- A year read as two numbers is not matched: \"nineteen twenty\" does not match `1920` (it is read as 19 and 20). The ordinal alone does not match an ordinal with a noun: `fourteenth` does not match `14th amendment`; `thirteen` does not match `13 original colonies`.",
    "- Any other spoken form the source does not list is not accepted, unless the project owner marked a parenthetical as an alternative name (**ALTNAME**), for example `Secretary of Defense` for 2025 question 48.",
    "- Sentence answers (**SENTENCE** flag) must be said almost in full, in the source's wording.",
    "- Answers that list several items in one line (for example question 16 in 2025, \"Legislative, executive, and judicial\") are stored as one phrase. Where the project owner decided so (**ANYORDER**), the items may be said in any order, but every item of the line is required and items of different lines are not mixed. Elsewhere they must be said in the source's order.",
    "- A number does not match when the response continues it (\"one hundred and one\" for `one hundred`), or when it starts in the middle of a larger number (\"twenty two\" for `two`).",
    "- Leading `the`, `a`, `an` in a stored answer is optional.",
    "- Dynamic questions have no stored answers and are never scored. They must not be offered as practice questions.",
    ""
  );

  out.push("## Flag codes", "");
  for (const [code, text] of Object.entries(FLAGS)) out.push(`- **${code}**: ${text}`);
  out.push("");

  out.push("## Where the source text was interpreted", "");
  for (const r of results) {
    out.push(`### ${r.version}`, "");
    for (const code of Object.keys(FLAGS)) {
      const hits = r.entries.filter((e) => e.flags.has(code)).map((e) => e.number);
      if (hits.length) out.push(`- **${code}** (${hits.length}): questions ${hits.join(", ")}`);
    }
    out.push("");
  }

  out.push("## 2008 web page compared with the older rev. 01/19 text", "");
  out.push(
    "The question numbers on the web page come from the order of its numbered lists. They were checked against the explicit numbers in the older official text (`uscis-2008-civics-100-rev0119.txt`). The older text is not used for any answer. Differences:",
    ""
  );
  if (comparison.length === 0) out.push("- none");
  for (const d of comparison) out.push(`- ${d}`);
  out.push("");

  for (const r of results) {
    out.push(`## ${r.version} test: questions in batches of ${BATCH_SIZE}`, "");
    for (let i = 0; i < r.entries.length; i += BATCH_SIZE) {
      const batch = r.entries.slice(i, i + BATCH_SIZE);
      out.push(`### ${r.version}: questions ${batch[0].number} to ${batch[batch.length - 1].number}`, "");
      out.push(reviewTable(batch), "");
      out.push("Reviewer: ______________  Date: ____________  Approved: [ ]", "");
    }
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const writes = new Set(
    process.argv.filter((a) => a.startsWith("--write=")).map((a) => a.slice("--write=".length))
  );
  const allProblems = [];
  const results = [];
  let comparison = [];
  const markers = loadMarkers();

  for (const version of ["2008", "2025"]) {
    const config = VERSIONS[version];
    const file = path.join(SOURCE_DIR, config.sourceFile);
    const parsed = config.kind === "html" ? parseHtml2008(file) : parseTxt2025(file);
    for (const p of parsed.problems) allProblems.push(`${version}: ${p}`);

    const numbering = checkNumbering(parsed.questions, config.expected);
    if (!numbering.ok) allProblems.push(`${version}: numbering is not 1 to ${config.expected}: ${JSON.stringify(numbering)}`);

    if (version === "2008") {
      const oldFile = path.join(SOURCE_DIR, config.crossCheckFile);
      const old = parseTxt2008Rev0119(oldFile);
      const oldNumbering = checkNumbering(old, config.expected);
      if (!oldNumbering.ok) allProblems.push(`2008 rev. 01/19: numbering is not 1 to ${config.expected}: ${JSON.stringify(oldNumbering)}`);
      comparison = compareWithRev0119(parsed.questions, old);
    }

    const entries = [];
    for (const q of parsed.questions) {
      try {
        entries.push(buildEntry(version, config, q, markers));
      } catch (error) {
        allProblems.push(`${version}: ${error.message}`);
      }
    }
    for (const e of entries) for (const p of nestingProblems(e)) allProblems.push(`${version}: ${p}`);
    results.push({ version, config, numbering, entries });
  }

  for (const m of markers) {
    if (!m.used) allProblems.push(`marker for ${m.question} ("${m.line}") matched no source answer line`);
  }

  // Report
  console.log("Answer key build report\n");
  for (const r of results) {
    const staticCount = r.entries.filter((e) => e.answerType === "static").length;
    const dynamicIds = r.entries.filter((e) => e.answerType === "dynamic").map((e) => e.number);
    console.log(`${r.version}: ${r.numbering.count} questions found (expected ${r.numbering.expected}); numbering ${r.numbering.ok ? "complete, 1 to " + r.numbering.expected : "NOT OK"}`);
    console.log(`   missing: ${r.numbering.missing.join(", ") || "none"}   repeated: ${r.numbering.duplicates.join(", ") || "none"}   out of order: ${r.numbering.outOfOrder.join(", ") || "none"}`);
    console.log(`   static ${staticCount}, dynamic ${dynamicIds.length} (${dynamicIds.join(", ")})`);
    const byFlag = Object.keys(FLAGS)
      .map((code) => [code, r.entries.filter((e) => e.flags.has(code)).length])
      .filter(([, n]) => n > 0)
      .map(([code, n]) => `${code}=${n}`);
    console.log(`   flags: ${byFlag.join(" ")}`);
  }
  console.log(`\n2008 web page vs rev. 01/19: ${comparison.length} difference(s)`);
  for (const d of comparison) console.log(`   - ${d}`);

  if (allProblems.length) {
    console.error(`\nPROBLEMS (${allProblems.length}) - nothing was written:`);
    for (const p of allProblems) console.error(`   - ${p}`);
    process.exit(1);
  }

  for (const r of results) {
    if (writes.has(r.version)) {
      fs.writeFileSync(r.config.output, fileJson(r.version, r.config, r.entries));
      console.log(`\nwrote ${rel(r.config.output)} (${r.entries.length} entries, needsHumanReview: true)`);
    }
  }
  if (writes.has("review")) {
    fs.mkdirSync(path.dirname(REVIEW_SHEET), { recursive: true });
    fs.writeFileSync(REVIEW_SHEET, reviewSheet(results, comparison));
    console.log(`\nwrote ${rel(REVIEW_SHEET)}`);
  }
  if (writes.size === 0) console.log("\nDry run. Nothing written. Use --write=2008, --write=2025 or --write=review.");
}


// Shared with tools/translations/import-n400.mjs (which only reads the parsed source questions).
export { parseTxt2025, parseHtml2008, VERSIONS, SOURCE_DIR, DYNAMIC_RE };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
