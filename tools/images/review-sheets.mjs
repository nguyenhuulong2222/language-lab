#!/usr/bin/env node
/**
 * tools/images/review-sheets.mjs
 *
 * Contact sheets for a quick owner review, one WebP per group, in docs/review-sheets/:
 *   federal-new.webp       federal pictures added on the content/full-pictures branch
 *   federal-earlier.webp   the federal pictures from before
 *   diagrams.webp          diagrams drawn from federal data
 *   ai-illustrations.webp  AI illustrations (each label says reviewed or not)
 * Each tile is labelled with the picture id. Docs only: the app never loads these files.
 *
 *   node --no-warnings tools/images/review-sheets.mjs
 *
 * Needs ImageMagick (`magick montage`). Uses a system font for the labels when one is found.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "docs/review-sheets");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
// Pictures added on this branch (content/full-pictures).
const NEW_FEDERAL = new Set([
  "john-jay-stuart",
  "federalist-1788-page",
  "landing-of-the-pilgrims-rothermel",
  "depression-breadline-sculpture",
  "world-war-ii-memorial-aerial",
  "fourth-of-july-fireworks",
  "korean-war-veterans-memorial",
  "vietnam-veterans-memorial-snow",
  "flight-93-national-memorial",
  "inf-treaty-signing-1987",
  "uss-ranger-returns-1991",
]);
const FONTS = ["/System/Library/Fonts/Helvetica.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:\\Windows\\Fonts\\arial.ttf"];
const font = FONTS.find((f) => fs.existsSync(f));
const federal = read("data/images/manifest.json").images;
const diagrams = read("data/images/diagrams-manifest.json").images;
const ai = read("data/images/illustrations-manifest.json").images;
const groups = [
  { name: "federal-new", tiles: federal.filter((p) => NEW_FEDERAL.has(p.id)).map((p) => ({ file: `public/images/civics/${p.file}`, label: p.id })) },
  { name: "federal-earlier", tiles: federal.filter((p) => !NEW_FEDERAL.has(p.id)).map((p) => ({ file: `public/images/civics/${p.file}`, label: p.id })) },
  { name: "diagrams", tiles: diagrams.map((d) => ({ file: `public/images/diagrams/${d.file}`, label: d.id })) },
  { name: "ai-illustrations", tiles: ai.map((e) => ({ file: `public/images/illustrations/${e.file}`, label: `${e.id}${e.reviewed ? "" : " (not reviewed)"}` })) },
];
fs.mkdirSync(OUT, { recursive: true });
for (const g of groups) {
  const tiles = g.tiles.filter((t) => fs.existsSync(path.join(ROOT, t.file)));
  if (tiles.length === 0) continue;
  const args = [...(font ? ["-font", font] : []), "-pointsize", "13", "-background", "#f7f8fc"];
  for (const t of tiles) args.push("-label", t.label, path.join(ROOT, t.file) + "[0]");
  const target = path.join(OUT, `${g.name}.webp`);
  args.push("-tile", "4x", "-geometry", "300x220+8+8", "-quality", "70", target);
  execFileSync("magick", ["montage", ...args]);
  console.log(`ok   docs/review-sheets/${g.name}.webp ${tiles.length} pictures, ${fs.statSync(target).size} bytes`);
}
