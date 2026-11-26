/**
 * src/engine/illustrations.ts
 *
 * AI illustrations for CONCEPT civics questions (abstract ideas such as the rule of law). Pure: no
 * React, no fetch.
 *
 *   data/images/illustration-prompts.json    our prompts, one per CONCEPT idea
 *   data/images/illustrations-manifest.json  what tools/images/generate-illustrations.mjs made
 *   data/images/question-classes.json        the picture class of every question (docs/image-plan.md)
 *
 * Rules:
 *   - an illustration is shown only when its manifest entry has reviewed: true (the owner looked at it);
 *   - it is only ever paired with a CONCEPT question, never with a PERSON, EVENT, DOCUMENT or DYNAMIC
 *     one: an AI picture of a real person, event or document would be a made-up likeness or record;
 *   - a federal photo, when a question has one, comes first;
 *   - like the photos, it is shown only after grading and in Study (that rule lives in the UI).
 */
import CLASSES_JSON from "../../data/images/question-classes.json" with { type: "json" };
import ILLUSTRATIONS_JSON from "../../data/images/illustrations-manifest.json" with { type: "json" };
export type PictureClass = "PERSON" | "PLACE" | "DOCUMENT" | "EVENT" | "SYMBOL" | "CONCEPT" | "DYNAMIC" | "NONE";
export const PICTURE_CLASSES: readonly PictureClass[] = ["PERSON", "PLACE", "DOCUMENT", "EVENT", "SYMBOL", "CONCEPT", "DYNAMIC", "NONE"];
/** Classes that must never get an AI illustration. */
export const NO_AI_CLASSES: readonly PictureClass[] = ["PERSON", "EVENT", "DOCUMENT", "DYNAMIC"];
export interface QuestionClasses {
  classes: Record<string, PictureClass>;
}
export interface IllustrationPrompt {
  id: string;
  questions: string[];
  scene: string;
  alt: string;
  caption: string;
}
export interface IllustrationPromptFile {
  model: string;
  size: string;
  quality: string;
  estimate: { usdPerImage: number; basis: string };
  style: string;
  rules: string;
  prompts: IllustrationPrompt[];
}
export interface IllustrationEntry {
  id: string;
  /** File name inside public/images/illustrations/. */
  file: string;
  questions: string[];
  model: string;
  /** The full prompt that was sent, word for word. */
  prompt: string;
  /** ISO date the picture was made. */
  date: string;
  /** SHA-256 of the image the API returned. */
  sha256: string;
  alt: string;
  caption: string;
  source: "ai";
  /** True only after the owner has looked at the picture. Unreviewed pictures are never shown. */
  reviewed: boolean;
  width: number;
  height: number;
  bytes: number;
}
export interface IllustrationManifest {
  images: IllustrationEntry[];
}
export const QUESTION_CLASSES = CLASSES_JSON as unknown as QuestionClasses;
export const ILLUSTRATIONS = ILLUSTRATIONS_JSON as unknown as IllustrationManifest;
/** The prompt sent to the image model: our style line, the scene, and the rules line. */
export function composePrompt(file: Pick<IllustrationPromptFile, "style" | "rules">, prompt: Pick<IllustrationPrompt, "scene">): string {
  return `${file.style} ${prompt.scene} ${file.rules}`;
}
/** Cost estimate for generating every prompt once, from the per-image figure recorded in the prompt file. */
export function estimateCost(file: Pick<IllustrationPromptFile, "estimate" | "prompts">): { count: number; usdPerImage: number; totalUsd: number } {
  const count = file.prompts.length;
  const usdPerImage = file.estimate.usdPerImage;
  return { count, usdPerImage, totalUsd: Math.round(count * usdPerImage * 100) / 100 };
}
/** The illustration of a question, or null. Only reviewed entries of CONCEPT questions count. */
export function illustrationForQuestion(
  questionId: string,
  manifest: IllustrationManifest = ILLUSTRATIONS,
  classes: QuestionClasses = QUESTION_CLASSES
): IllustrationEntry | null {
  if (classes.classes[questionId] !== "CONCEPT") return null;
  return manifest.images.find((e) => e.reviewed === true && e.source === "ai" && e.questions.includes(questionId)) ?? null;
}
/** URL of an illustration file, relative to the site root. */
export function illustrationUrl(entry: IllustrationEntry): string {
  return `/images/illustrations/${entry.file}`;
}
export interface IllustrationProblem {
  where: string;
  problem: string;
}
export interface IllustrationCheckInput {
  prompts: IllustrationPromptFile;
  manifest: IllustrationManifest;
  classes: QuestionClasses;
  /** Every question id of both test versions, with its answer type. */
  questions: readonly { id: string; answerType: string }[];
  /** File names present in public/images/illustrations/. */
  files: ReadonlySet<string>;
}
/** Every rule above that the data can break. An empty list means the data is consistent. */
export function checkIllustrationData(input: IllustrationCheckInput): IllustrationProblem[] {
  const problems: IllustrationProblem[] = [];
  const add = (where: string, problem: string) => problems.push({ where, problem });
  const { prompts, manifest, classes } = input;
  const ids = new Set(input.questions.map((q) => q.id));
  for (const q of input.questions) {
    const cls = classes.classes[q.id];
    if (cls === undefined) add(`question ${q.id}`, "has no picture class");
    else if (!PICTURE_CLASSES.includes(cls)) add(`question ${q.id}`, `unknown class ${cls}`);
    if (q.answerType === "dynamic" && cls !== "DYNAMIC") add(`question ${q.id}`, "answer type is dynamic but the class is not DYNAMIC");
  }
  for (const id of Object.keys(classes.classes)) if (!ids.has(id)) add(`class ${id}`, "not a question id of either test version");
  const covered = new Map<string, string>();
  const promptIds = new Set<string>();
  for (const p of prompts.prompts) {
    const where = `prompt ${p.id}`;
    if (promptIds.has(p.id)) add(where, "id is used twice");
    promptIds.add(p.id);
    for (const field of ["scene", "alt", "caption"] as const) if (typeof p[field] !== "string" || p[field].trim() === "") add(where, `${field} is empty`);
    if (!composePrompt(prompts, p).includes(prompts.rules)) add(where, "prompt does not end with the rules line");
    if (p.questions.length === 0) add(where, "has no questions");
    for (const q of p.questions) {
      if (classes.classes[q] !== "CONCEPT") add(where, `question ${q} is ${classes.classes[q] ?? "unknown"}, not CONCEPT`);
      if (covered.has(q)) add(where, `question ${q} is also in prompt ${covered.get(q)}`);
      covered.set(q, p.id);
    }
  }
  for (const [q, cls] of Object.entries(classes.classes)) if (cls === "CONCEPT" && !covered.has(q)) add(`question ${q}`, "is CONCEPT but has no prompt");
  if (!/\bno text\b/i.test(prompts.rules) || !/no real or historical person/i.test(prompts.rules) || !/no seals, eagles/i.test(prompts.rules)) {
    add("rules", "the rules line must forbid text, real people, and seals or eagles");
  }
  const byPrompt = new Map(prompts.prompts.map((p) => [p.id, p]));
  for (const e of manifest.images) {
    const where = `illustration ${e.id}`;
    if (e.source !== "ai") add(where, 'source is not "ai"');
    if (typeof e.reviewed !== "boolean") add(where, "reviewed is not true or false");
    if (typeof e.model !== "string" || e.model.trim() === "") add(where, "model is empty");
    if (!/^[0-9a-f]{64}$/.test(e.sha256)) add(where, "sha256 is not 64 hex digits");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) add(where, "date is not an ISO date");
    if (!/\.webp$/.test(e.file)) add(where, "file is not WebP");
    if (!input.files.has(e.file)) add(where, `file ${e.file} is not in public/images/illustrations/`);
    if (Math.max(e.width, e.height) > 1200) add(where, "longest side is over 1200px");
    if (e.bytes > 150_000) add(where, `file is ${e.bytes} bytes, over the 150 kB target`);
    if (!e.prompt.includes(prompts.rules)) add(where, "prompt does not include the rules line");
    if (e.alt.trim() === "") add(where, "alt text is empty");
    for (const q of e.questions) {
      const cls = classes.classes[q];
      if (cls !== "CONCEPT") add(where, `paired with ${q}, which is ${cls ?? "unknown"}, not CONCEPT`);
    }
    if (!byPrompt.has(e.id)) add(where, "has no prompt in illustration-prompts.json");
  }
  const listed = new Set(manifest.images.map((e) => e.file));
  for (const f of input.files) if (!listed.has(f)) add(`file ${f}`, "is in public/images/illustrations/ but not in the manifest");
  return problems;
}
