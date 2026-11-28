/**
 * src/engine/own-name.ts
 *
 * "Use my name" (decisions log S; the narrow exception to content-safety rule 1): the learner types
 * their own name to practise saying and spelling it. Everything else comes from a sample profile.
 *
 * Privacy rules this module serves:
 *   - the name is kept only in memory by the UI (never in storage, a cookie, the URL or a log);
 *   - the name is put into the officer's greeting and the full-name question on the device only;
 *   - anything sent to the AI coach uses the sample profile's name instead (`protectNameForCoach`).
 *
 * Pure: no React, no DOM, no network.
 */
import OWN_NAME_JSON from "../../data/practice/own-name.json" with { type: "json" };
import type { N400Answer, N400Coach, N400Prompt } from "./n400-coach.js";
export const OWN_NAME_MAX = 60;
export interface OwnNameScript {
  /** The sample profile whose other answers are used. */
  baseProfileId: string;
  /** The officer's greeting; {name} is the learner's name. */
  greeting: string;
  /** The scripted question that asks for the full name. */
  nameQuestionId: string;
  /** Its sample answer; {name} is the learner's name. */
  nameSampleAnswer: string;
  /** The extra question asked right after the full-name question. */
  spelling: { id: string; text: string };
}
export const OWN_NAME_SCRIPT = OWN_NAME_JSON as unknown as OwnNameScript;
export type OwnNameCheck = { ok: true; name: string } | { ok: false; problem: "empty" | "tooLong" | "characters" };
/** Trim, and turn every run of spaces (including tabs and new lines) into one space. */
export function normaliseOwnName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/gu, " ").trim();
}
/** Letters (with their accents), spaces, hyphens and apostrophes; at least one letter. */
const ALLOWED = /^[\p{L}\p{M} '’-]+$/u;
export function checkOwnName(raw: string): OwnNameCheck {
  const name = normaliseOwnName(raw);
  if (name === "") return { ok: false, problem: "empty" };
  if ([...name].length > OWN_NAME_MAX) return { ok: false, problem: "tooLong" };
  if (!ALLOWED.test(name) || !/\p{L}/u.test(name)) return { ok: false, problem: "characters" };
  return { ok: true, name };
}
/** The parts of a name, as typed ("Nguyễn Văn An" → ["Nguyễn", "Văn", "An"]). */
export function nameParts(name: string): string[] {
  return normaliseOwnName(name).split(" ").filter((p) => /\p{L}/u.test(p));
}
/** Letters only, without accents, lower case ("Nguyễn" → "nguyen", "Đặng" → "dang", "O'Brien" → "obrien"). */
export function plainLetters(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^\p{L}]/gu, "");
}
/** How a word is spelled out loud in English letters ("Nguyễn" → "N-G-U-Y-E-N"). */
export function spellWord(word: string): string {
  return [...plainLetters(word).toUpperCase()].join("-");
}
/** The spelling of every part of the name, for the sample answer of the spelling question. */
export function spellingOfParts(name: string): string {
  return nameParts(name)
    .map((part) => `${part}: ${spellWord(part)}`)
    .join(". ");
}
export const fillName = (template: string, name: string): string => template.replaceAll("{name}", name);
/**
 * The scripted coach with the learner's name: the full-name question's sample answer uses the name,
 * and the spelling question comes right after it. Every other question and sample answer is the
 * base coach's (the sample profile's). Runs on the device only.
 */
export function createOwnNameCoach(base: N400Coach, name: string, script: OwnNameScript = OWN_NAME_SCRIPT): N400Coach {
  const spellingPrompt: N400Prompt = { id: script.spelling.id, text: script.spelling.text, sampleAnswer: spellingOfParts(name) };
  const withoutSpelling = (answered: readonly N400Answer[]) => answered.filter((a) => a.questionId !== script.spelling.id);
  return {
    async nextQuestion(context) {
      const answeredName = context.answered.some((a) => a.questionId === script.nameQuestionId);
      const answeredSpelling = context.answered.some((a) => a.questionId === script.spelling.id);
      if (answeredName && !answeredSpelling) return spellingPrompt;
      const prompt = await base.nextQuestion({ ...context, answered: withoutSpelling(context.answered) });
      if (prompt !== null && prompt.id === script.nameQuestionId) return { ...prompt, sampleAnswer: fillName(script.nameSampleAnswer, name) };
      return prompt;
    },
    feedback(context, answer) {
      return base.feedback({ ...context, answered: withoutSpelling(context.answered) }, answer);
    },
  };
}
/** True for a question whose answer must never go to the AI coach in "Use my name" (the spelling question is not in the server's script). */
export function isLocalOnlyQuestion(questionId: string, script: OwnNameScript = OWN_NAME_SCRIPT): boolean {
  return questionId === script.spelling.id;
}
/** Lower case, without accents (đ as d): how two spellings of the same name are compared. */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
/**
 * The answer as it may be sent to the AI coach: every run of the learner's name parts is replaced by
 * the sample profile's name. Returns null when the name may still be in the text (for example
 * spelled out letter by letter): the answer is then not sent at all.
 * A two-letter part ("An") starts a run only when written with a capital, so "an engineer" stays;
 * next to another part it always belongs to the run ("nguyen van an").
 */
export function protectNameForCoach(answer: string, name: string, sampleName: string): string | null {
  const parts = nameParts(name);
  if (parts.length === 0) return answer;
  const plainParts = new Set(parts.map(plainLetters).filter((p) => p.length > 0));
  // Words of the answer, with what lies between them, so the text can be put back together.
  const pieces = answer.split(/([\p{L}\p{M}'’-]+)/u);
  const isNamePart = (word: string, inRun: boolean) => {
    const plain = plainLetters(word);
    if (!plainParts.has(plain)) return false;
    return inRun || plain.length >= 3 || /^\p{Lu}/u.test(word);
  };
  const out: string[] = [];
  let inRun = false;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]!;
    const isWord = i % 2 === 1;
    if (isWord && isNamePart(piece, inRun)) {
      if (!inRun) out.push(sampleName);
      inRun = true;
      continue;
    }
    // Spaces between two name parts belong to the run.
    if (!isWord && inRun && /^\s+$/u.test(piece) && i + 1 < pieces.length && isNamePart(pieces[i + 1]!, true)) continue;
    inRun = false;
    out.push(piece);
  }
  const text = out.join("");
  // Final checks (a part is letters only, so it needs no escaping in a pattern).
  // A name spelled letter by letter ("N-G-U-Y-E-N", "n g u y e n"): the single letters in a row.
  const singles = plainLetters((text.match(/(?<!\p{L})\p{L}(?!\p{L})/gu) ?? []).join(""));
  const folded = fold(text);
  for (const part of plainParts) {
    if (part.length >= 2 && singles.includes(part)) return null;
    if (part.length >= 3 && new RegExp(`(?:^|[^\\p{L}])${part}(?=[^\\p{L}]|$)`, "u").test(folded)) return null;
  }
  return text;
}
