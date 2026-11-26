/**
 * src/engine/diagrams.ts
 *
 * Diagrams (kind "diagram"): maps and the 50-star flag drawn by tools/images/draw-diagrams.mjs from
 * U.S. Census Bureau and USGS data and the U.S. flag code. Pure: no React, no fetch.
 *
 *   data/images/diagrams-manifest.json   every diagram, its questions and its federal sources
 *
 * Rules:
 *   - a diagram is shown only when its manifest entry has reviewed: true;
 *   - it is never paired with a DYNAMIC or NONE question;
 *   - it is shown like a federal picture (after grading and in Study), with its credit line.
 */
import DIAGRAMS_JSON from "../../data/images/diagrams-manifest.json" with { type: "json" };
import CLASSES_JSON from "../../data/images/question-classes.json" with { type: "json" };
import type { PictureEntry } from "./question-images.ts";
export const DIAGRAM_LEGAL_BASIS = "U.S. Government work, public domain (17 U.S.C. §105)";
/** Hosts a diagram's source data may come from: the Census Bureau, USGS (and its National Map download host), the flag law. */
export const DIAGRAM_SOURCE_HOSTS: readonly string[] = ["census.gov", "usgs.gov", "prd-tnm.s3.amazonaws.com", "govinfo.gov", "archives.gov"];
export interface DiagramSource {
  id: string;
  publisher: string;
  url: string;
  downloadedOn: string;
  sha256: string;
}
export interface DiagramEntry {
  id: string;
  kind: "diagram";
  /** File name inside public/images/diagrams/. */
  file: string;
  questions: string[];
  title: string;
  alt: string;
  caption: string;
  /** Shown under the diagram, for example "Drawn from U.S. Census Bureau data". */
  creditLine: string;
  legalBasis: string;
  sources: DiagramSource[];
  /** For diagrams drawn from a law rather than data (the flag): the law, with its URL. */
  drawnFrom?: string[];
  /** For the flag: what the drawing code produced. */
  counts?: { stars: number; stripes: number };
  drawnOn: string;
  /** SHA-256 of the WebP file. */
  sha256: string;
  width: number;
  height: number;
  bytes: number;
  reviewed: boolean;
}
export interface DiagramManifest {
  images: DiagramEntry[];
}
export const DIAGRAMS = DIAGRAMS_JSON as unknown as DiagramManifest;
const CLASSES = (CLASSES_JSON as unknown as { classes: Record<string, string> }).classes;
/** The diagram as a picture entry, so the existing picture component shows it with its credit line. */
export function diagramAsPicture(d: DiagramEntry): PictureEntry {
  const source = d.sources[0]?.url ?? (d.drawnFrom?.[0]?.match(/https:\/\/\S+(?=\))/)?.[0] ?? "");
  return {
    id: d.id,
    kind: "diagram",
    file: d.file,
    title: d.title,
    creator: d.creditLine,
    date: d.drawnOn,
    sourcePageUrl: source,
    fileUrl: source,
    rights: d.legalBasis,
    downloadedOn: d.drawnOn,
    sha256: d.sha256,
    alt: d.alt,
    caption: d.caption,
    width: d.width,
    height: d.height,
    bytes: d.bytes,
  };
}
/** The reviewed diagram of a question, or null. Never one for a DYNAMIC or NONE question. */
export function diagramForQuestion(
  questionId: string,
  manifest: DiagramManifest = DIAGRAMS,
  classes: Record<string, string> = CLASSES
): DiagramEntry | null {
  const cls = classes[questionId];
  if (cls === undefined || cls === "DYNAMIC" || cls === "NONE") return null;
  return manifest.images.find((d) => d.reviewed === true && d.kind === "diagram" && d.questions.includes(questionId)) ?? null;
}
function hostAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && DIAGRAM_SOURCE_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
export interface DiagramProblem {
  where: string;
  problem: string;
}
/** Every rule the data can break. An empty list means the data is consistent. */
export function checkDiagramData(input: {
  manifest: DiagramManifest;
  classes: Record<string, string>;
  questionIds: readonly string[];
  files: ReadonlySet<string>;
  /** Question ids that already have a federal picture. */
  pictured?: ReadonlySet<string>;
}): DiagramProblem[] {
  const problems: DiagramProblem[] = [];
  const add = (where: string, problem: string) => problems.push({ where, problem });
  const known = new Set(input.questionIds);
  const seen = new Set<string>();
  for (const d of input.manifest.images) {
    const where = `diagram ${d.id}`;
    if (seen.has(d.id)) add(where, "id is used twice");
    seen.add(d.id);
    if (d.kind !== "diagram") add(where, 'kind is not "diagram"');
    if (typeof d.reviewed !== "boolean") add(where, "reviewed is not true or false");
    if (d.legalBasis !== DIAGRAM_LEGAL_BASIS) add(where, "legal basis is not the U.S. Government work statement");
    if (!/^Drawn from /.test(d.creditLine)) add(where, 'credit line does not start with "Drawn from"');
    for (const f of ["title", "alt", "caption"] as const) if (d[f].trim() === "") add(where, `${f} is empty`);
    if (!/\.webp$/.test(d.file)) add(where, "file is not WebP");
    if (!input.files.has(d.file)) add(where, `file ${d.file} is not in public/images/diagrams/`);
    if (Math.max(d.width, d.height) > 1200) add(where, "longest side is over 1200px");
    if (d.bytes > 150_000) add(where, `file is ${d.bytes} bytes, over the 150 kB target`);
    if (!/^[0-9a-f]{64}$/.test(d.sha256)) add(where, "sha256 is not 64 hex digits");
    if (d.sources.length === 0 && (d.drawnFrom ?? []).length === 0) add(where, "has no data source and no law it is drawn from");
    for (const s of d.sources) {
      if (!hostAllowed(s.url)) add(where, `source ${s.url} is not a Census Bureau or USGS URL`);
      if (!/^[0-9a-f]{64}$/.test(s.sha256)) add(where, `source ${s.id} has no SHA-256`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.downloadedOn)) add(where, `source ${s.id} has no download date`);
    }
    for (const law of d.drawnFrom ?? []) {
      const url = law.match(/https:\/\/\S+(?=\))/)?.[0];
      if (url === undefined || !hostAllowed(url)) add(where, `law reference has no federal URL: ${law}`);
    }
    if (d.questions.length === 0) add(where, "has no questions");
    for (const q of d.questions) {
      if (!known.has(q)) add(where, `question ${q} does not exist`);
      const cls = input.classes[q];
      if (cls === "DYNAMIC" || cls === "NONE") add(where, `paired with ${q}, which is ${cls}`);
      if (input.pictured?.has(q)) add(where, `question ${q} already has a federal picture`);
    }
  }
  const listed = new Set(input.manifest.images.map((d) => d.file));
  for (const f of input.files) if (!listed.has(f)) add(`file ${f}`, "is in public/images/diagrams/ but not in the manifest");
  return problems;
}
