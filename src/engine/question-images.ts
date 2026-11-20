/**
 * src/engine/question-images.ts
 *
 * Pictures for civics questions (spec BS-20). Pure: no React, no fetch.
 *
 * A picture is a public-domain or openly licensed work from an official U.S. federal source, with
 * a rights statement copied word for word from the source's own record. Pictures are display
 * only: scoring never reads them, and a picture is never shown before or during an answer
 * (that rule lives in the UI and is tested there).
 *
 *   data/images/manifest.json         every picture and where it came from
 *   data/images/question-images.json  question id -> picture id (needsHumanReview)
 */
import MANIFEST_JSON from "../../data/images/manifest.json" with { type: "json" };
import MAPPING_JSON from "../../data/images/question-images.json" with { type: "json" };

export interface PictureEntry {
  id: string;
  /** File name inside public/images/civics/. */
  file: string;
  title: string;
  creator: string;
  date: string;
  sourcePageUrl: string;
  fileUrl: string;
  /** The rights statement of the source record, word for word. */
  rights: string;
  downloadedOn: string;
  /** SHA-256 of the original download (the original itself is not committed). */
  sha256: string;
  alt: string;
  /** The source's own title or description. Not written by us. */
  caption: string;
  width: number;
  height: number;
  bytes: number;
}

export interface PictureManifest {
  images: PictureEntry[];
}

export interface QuestionImageMapping {
  needsHumanReview: boolean;
  questions: Record<string, string>;
}

/** Hosts a picture page or file may come from (official U.S. federal sources, spec BS-20). */
export const FEDERAL_HOSTS: readonly string[] = [
  "loc.gov",
  "archives.gov",
  "aoc.gov",
  "nps.gov",
  "si.edu",
  "nasa.gov",
  "usa.gov",
  "defense.gov",
  "af.mil",
  "army.mil",
  "navy.mil",
  "marines.mil",
  "uscg.mil",
  "fema.gov",
  "state.gov",
  "whitehouse.gov",
];

export function isFederalUrl(url: string): boolean {
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    host = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }
  return FEDERAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * True for the rights statements we accept: "no known restrictions on publication", public
 * domain, U.S. Government work, CC0. A statement that names a rights holder, asks for permission,
 * says the status was not evaluated, or warns that publication may be restricted is refused.
 */
export function acceptableRights(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const cleaned = text.replace(/Copyright and Other Restrictions/gi, "");
  if (/not evaluated|copyright|rights holder|permission|restrict(?:ed|ion)s? (?:may|apply)|may be restricted|all rights reserved|credit line|courtesy of/i.test(cleaned.replace(/no know?n? (?:copyright )?restrictions?/gi, ""))) {
    return false;
  }
  return /no know?n? (?:copyright )?restrictions? on (?:publication|use or reproduction)|public domain|u\.s\. government (?:work|publication)|\bCC0\b/i.test(text);
}

export interface ImageProblem {
  where: string;
  problem: string;
}

export interface ImageCheckInput {
  manifest: PictureManifest;
  mapping: QuestionImageMapping;
  /** Every question id of both test versions. */
  questionIds: readonly string[];
  /** File names present in public/images/civics/. */
  files: ReadonlySet<string>;
}

const REQUIRED_TEXT_FIELDS = [
  "id",
  "file",
  "title",
  "creator",
  "date",
  "sourcePageUrl",
  "fileUrl",
  "rights",
  "downloadedOn",
  "sha256",
  "alt",
  "caption",
] as const;

/** Every problem with the picture data. An empty list means the data is consistent. */
export function checkImageData(input: ImageCheckInput): ImageProblem[] {
  const problems: ImageProblem[] = [];
  const add = (where: string, problem: string) => problems.push({ where, problem });
  const ids = new Set<string>();
  const used = new Set<string>();
  for (const picture of input.manifest.images) {
    const where = `picture ${picture.id}`;
    if (ids.has(picture.id)) add(where, "duplicate id");
    ids.add(picture.id);
    for (const field of REQUIRED_TEXT_FIELDS) {
      const value = picture[field];
      if (typeof value !== "string" || value.trim() === "") add(where, `${field} is empty`);
    }
    if (typeof picture.rights === "string" && picture.rights.trim() !== "" && !acceptableRights(picture.rights)) {
      add(where, `rights statement is not an accepted one: "${picture.rights}"`);
    }
    if (!isFederalUrl(picture.sourcePageUrl)) add(where, "source page is not on a U.S. federal site");
    if (!isFederalUrl(picture.fileUrl)) add(where, "file URL is not on a U.S. federal site");
    if (!/^[0-9a-f]{64}$/.test(picture.sha256)) add(where, "sha256 is not 64 hex digits");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(picture.downloadedOn)) add(where, "downloadedOn is not an ISO date");
    if (!input.files.has(picture.file)) add(where, `file ${picture.file} is not in public/images/civics/`);
    if (!/\.webp$/.test(picture.file)) add(where, "file is not WebP");
    if (Math.max(picture.width, picture.height) > 1200) add(where, "longest side is over 1200px");
    if (picture.bytes > 150_000) add(where, `file is ${picture.bytes} bytes, over the 150 kB target`);
  }
  const knownQuestions = new Set(input.questionIds);
  for (const [questionId, pictureId] of Object.entries(input.mapping.questions)) {
    const where = `question ${questionId}`;
    if (!knownQuestions.has(questionId)) add(where, "not a question id of either test version");
    if (!ids.has(pictureId)) add(where, `maps to ${pictureId}, which is not in the manifest`);
    used.add(pictureId);
  }
  for (const id of ids) if (!used.has(id)) add(`picture ${id}`, "is in the manifest but no question uses it");
  const listed = new Set(input.manifest.images.map((p) => p.file));
  for (const file of input.files) if (!listed.has(file)) add(`file ${file}`, "is in public/images/civics/ but not in the manifest");
  if (input.mapping.needsHumanReview !== true) add("question-images.json", "needsHumanReview must stay true until the owner has checked every pairing");
  return problems;
}

export const PICTURE_MANIFEST = MANIFEST_JSON as unknown as PictureManifest;
export const QUESTION_IMAGES = MAPPING_JSON as unknown as QuestionImageMapping;

const byId = new Map(PICTURE_MANIFEST.images.map((p) => [p.id, p]));

/** The picture of a question, or null when it has none. */
export function pictureForQuestion(questionId: string, mapping: QuestionImageMapping = QUESTION_IMAGES): PictureEntry | null {
  const pictureId = mapping.questions[questionId];
  return pictureId === undefined ? null : (byId.get(pictureId) ?? null);
}

/** URL of a picture file, relative to the site root. */
export function pictureUrl(picture: PictureEntry): string {
  return `/images/civics/${picture.file}`;
}
