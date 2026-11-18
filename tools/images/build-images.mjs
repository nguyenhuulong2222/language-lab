#!/usr/bin/env node
/**
 * tools/images/build-images.mjs
 *
 * Builds the picture set from data/images/picks.json:
 *   - reads each loc.gov item record and refuses the picture unless its own rights statement is an
 *     accepted one (see acceptableRights in src/engine/question-images.ts);
 *   - downloads the largest JPEG (or the master TIFF when no big JPEG exists) to a temp folder;
 *   - writes an optimised WebP (longest side 1200px, under about 150 kB) to public/images/civics/;
 *   - writes data/images/manifest.json (rights text copied word for word, SHA-256 of the download),
 *     data/images/question-images.json, data/images/todo.json, and the three docs.
 * The full-size download is never written inside the repository. Pictures already built are kept
 * (same id, same item) so re-running is cheap. A failed picture goes to docs/image-todo.md and no
 * other source is tried.
 *
 *   node --no-warnings tools/images/build-images.mjs            build or update
 *   node --no-warnings tools/images/build-images.mjs --docs     only regenerate the docs
 *
 * Needs ImageMagick (`magick`) with WebP support. Developer tool, not part of `npm test`.
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCredits, buildReview, buildTodo } from "../../src/engine/image-docs.ts";
import { acceptableRights } from "../../src/engine/question-images.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const UA = "LanguageLabResearch/1.0 (practice tool; public-domain pictures)";
const OUT = path.join(ROOT, "public/images/civics");
const TMP = path.join(os.tmpdir(), "language-lab-images");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (f, fallback) => (fs.existsSync(path.join(ROOT, f)) ? JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")) : fallback);
const write = (f, text) => {
  fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, f), text);
};

async function fetchRetry(url, asBuffer) {
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(120000) });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await sleep(1000);
      return asBuffer ? Buffer.from(await res.arrayBuffer()) : await res.json();
    } catch (e) {
      if (i === 5) throw e;
      await sleep(4000 * (i + 1));
    }
  }
}

function questionInfos() {
  const out = [];
  for (const v of ["2008", "2025"]) {
    for (const e of read(`data/civics-answers/${v}.json`).entries) out.push({ id: e.id, version: v, text: e.questionText });
  }
  return out;
}

function writeDocs(manifest, mapping, todo) {
  write("docs/image-credits.md", buildCredits(manifest, mapping));
  write("docs/image-review.md", buildReview(manifest, mapping, questionInfos()));
  write("docs/image-todo.md", buildTodo(todo));
}

/** The files of an item record: the biggest JPEG, or the master TIFF when the JPEGs are small. */
function chooseFile(record) {
  const files = (record.resources?.[0]?.files ?? []).flat();
  const jpegs = files.filter((f) => f.mimetype === "image/jpeg" && !/_150px|_thumb/.test(f.url)).sort((a, b) => b.width - a.width);
  const tiff = files.find((f) => f.mimetype === "image/tiff" && f.size < 60_000_000);
  if (jpegs[0] !== undefined && (jpegs[0].width >= 900 || tiff === undefined)) return jpegs[0];
  return tiff ?? jpegs[0];
}

function toWebp(input, output) {
  // Fine engravings need a lower quality or a smaller size to stay under about 150 kB.
  for (const side of [1200, 1050, 900, 780]) {
    for (const quality of [82, 74, 66, 58, 50, 42]) {
      execFileSync("magick", [input + "[0]", "-auto-orient", "-resize", `${side}x${side}>`, "-strip", "-quality", String(quality), "-define", "webp:method=6", output]);
      if (fs.statSync(output).size <= 145_000) return quality;
    }
  }
  return -1;
}

const picks = read("data/images/picks.json", { picks: [] }).picks;
const manifest = read("data/images/manifest.json", { images: [] });
let todo = [];
if (!process.argv.includes("--docs")) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });
  const built = new Map(manifest.images.map((p) => [p.id, p]));
  const images = [];
  const siRecords = new Map(read("data/images/si-records.json", { records: [] }).records.map((r) => [r.recordId, r]));
  for (const pick of picks) {
    const isSi = pick.source === "si";
    const pageUrl = isSi ? `https://www.si.edu/object/${pick.record}` : `https://www.loc.gov/item/${pick.locItem}/`;
    const fail = (reason) => {
      console.log(`SKIP ${pick.id}: ${reason}`);
      todo.push({ wanted: pick.wanted ?? pick.id, pageUrl, reason });
    };
    const have = built.get(pick.id);
    if (have !== undefined && have.sourcePageUrl === pageUrl && fs.existsSync(path.join(OUT, have.file)) && have.alt === pick.alt) {
      images.push(have);
      console.log(`keep ${pick.id}`);
      continue;
    }
    try {
      if (isSi) {
        // Smithsonian Open Access: the rights statement is the record's own usage access ("CC0").
        const rec = siRecords.get(pick.record);
        if (rec === undefined) {
          fail("no Smithsonian record snapshot in data/images/si-records.json");
          continue;
        }
        const rights = `Smithsonian Open Access record states usage access "${rec.mediaAccess}" (Creative Commons Zero, public domain dedication)`;
        if (rec.mediaAccess !== "CC0" || !acceptableRights(rights)) {
          fail(`rights statement is not CC0: "${rec.mediaAccess}"`);
          continue;
        }
        const fileUrl = `${rec.mediaUrl}&max=1600`;
        const data = await fetchRetry(fileUrl, true);
        const sha256 = crypto.createHash("sha256").update(data).digest("hex");
        const original = path.join(TMP, `${pick.id}.jpg`);
        fs.writeFileSync(original, data);
        const target = path.join(OUT, `${pick.id}.webp`);
        const quality = toWebp(original, target);
        if (quality < 0) {
          fs.rmSync(target, { force: true });
          fail("could not get the WebP under 150 kB");
          continue;
        }
        const [w, h] = execFileSync("magick", ["identify", "-format", "%w %h", target]).toString().split(" ").map(Number);
        images.push({
          id: pick.id,
          file: `${pick.id}.webp`,
          title: rec.title,
          creator: rec.creator,
          date: rec.date,
          sourcePageUrl: pageUrl,
          fileUrl,
          rights,
          downloadedOn: new Date().toISOString().slice(0, 10),
          sha256,
          alt: pick.alt,
          caption: rec.title,
          width: w,
          height: h,
          bytes: fs.statSync(target).size,
        });
        console.log(`ok   ${pick.id} ${w}x${h} ${fs.statSync(target).size} bytes (q${quality}) [Smithsonian]`);
        continue;
      }
      const record = await fetchRetry(`${pageUrl}?fo=json`);
      const item = record.item;
      const rights = item.rights_advisory ?? item.rights_information ?? "";
      if (!acceptableRights(rights)) {
        fail(`rights statement is not an accepted one: "${String(rights).replace(/\s+/g, " ").slice(0, 160)}"`);
        continue;
      }
      const file = chooseFile(record);
      if (file === undefined) {
        fail("the record lists no downloadable image file");
        continue;
      }
      const data = await fetchRetry(file.url, true);
      const sha256 = crypto.createHash("sha256").update(data).digest("hex");
      const original = path.join(TMP, `${pick.id}${path.extname(new URL(file.url).pathname)}`);
      fs.writeFileSync(original, data);
      const target = path.join(OUT, `${pick.id}.webp`);
      const quality = toWebp(original, target);
      if (quality < 0) {
        fs.rmSync(target, { force: true });
        fail("could not get the WebP under 150 kB");
        continue;
      }
      const [w, h] = execFileSync("magick", ["identify", "-format", "%w %h", target]).toString().split(" ").map(Number);
      const creator = (item.contributor_names ?? []).join("; ") || (item.creators ?? []).map((c) => c.title ?? c).join("; ") || "Unknown";
      images.push({
        id: pick.id,
        file: `${pick.id}.webp`,
        title: String(item.title).trim(),
        creator,
        date: String(item.created_published_date ?? item.date ?? "").trim(),
        sourcePageUrl: pageUrl,
        fileUrl: file.url,
        rights: String(rights).replace(/\s+/g, " ").trim(),
        downloadedOn: new Date().toISOString().slice(0, 10),
        sha256,
        alt: pick.alt,
        caption: String(item.title).trim(),
        width: w,
        height: h,
        bytes: fs.statSync(target).size,
      });
      console.log(`ok   ${pick.id} ${w}x${h} ${fs.statSync(target).size} bytes (q${quality})`);
    } catch (e) {
      fail(`download or conversion failed: ${e.message}`);
    }
  }
  manifest.images = images;
  write("data/images/manifest.json", JSON.stringify(manifest, null, 1) + "\n");
  const okIds = new Set(images.map((p) => p.id));
  const questions = {};
  for (const pick of picks) if (okIds.has(pick.id)) for (const q of pick.questions) questions[q] = pick.id;
  write("data/images/question-images.json", JSON.stringify({ _note: "Question id -> picture id. Generated from data/images/picks.json by tools/images/build-images.mjs. Check every pairing in docs/image-review.md.", needsHumanReview: true, questions }, null, 1) + "\n");
  // Remove files of pictures no longer wanted.
  for (const f of fs.readdirSync(OUT)) if (!images.some((p) => p.file === f)) fs.rmSync(path.join(OUT, f));
  write("data/images/todo.json", JSON.stringify(todo, null, 1) + "\n");
} else {
  todo = read("data/images/todo.json", []);
}
writeDocs(read("data/images/manifest.json", { images: [] }), read("data/images/question-images.json", { questions: {} }), todo);
const total = fs.existsSync(OUT) ? fs.readdirSync(OUT).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0) : 0;
console.log(`Done. ${manifest.images.length} pictures, ${(total / 1e6).toFixed(1)} MB in public/images/civics/.`);
