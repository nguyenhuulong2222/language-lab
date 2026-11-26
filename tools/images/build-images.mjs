#!/usr/bin/env node
/**
 * tools/images/build-images.mjs
 *
 * Builds the picture set from data/images/picks.json:
 *   - reads each item record (loc.gov, a Smithsonian Open Access snapshot, the National Archives
 *     Catalog by naId, or an NPGallery asset page of the National Park Service) and refuses the picture unless its own rights statement is an accepted one
 *     (see acceptableRights in src/engine/question-images.ts; National Archives records need
 *     use and access restriction "Unrestricted"; NPGallery assets need the constraint "Public domain"
 *     and an NPS photo credit);
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
import { buildCredits, buildReview, buildTodo, parseOwnerOk } from "../../src/engine/image-docs.ts";
import { acceptableRights } from "../../src/engine/question-images.ts";
import { toWebp } from "./webp.mjs";

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

let blocked = false; // loc.gov answered 429: stop asking, so the block is not extended
async function fetchRetry(url, asBuffer) {
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(120000) });
      if (res.status === 429) {
        blocked = true;
        throw Object.assign(new Error("HTTP 429 (blocked)"), { fatal: true });
      }
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await sleep(1000);
      return asBuffer ? Buffer.from(await res.arrayBuffer()) : await res.json();
    } catch (e) {
      if (i === 5 || e.fatal) throw e;
      await sleep(4000 * (i + 1));
    }
  }
}

/** What a pick's crop does, in words for the credits, or undefined when the file is only resized. */
function editText(pick) {
  if (pick.crop === undefined) return undefined;
  if (pick.crop === "stereo-left") return "Cropped to the left photo of the stereograph card.";
  return `Cropped to ${pick.crop.why}.`;
}
/** Applies a pick's crop to the downloaded file in place: "stereo-left", or { x, y, w, h, why } as fractions of the width and height. */
function applyCrop(original, pick) {
  if (pick.crop === undefined) return;
  if (pick.crop === "stereo-left") {
    execFileSync("magick", [original + "[0]", "-gravity", "West", "-crop", "50%x100%+0+0", "+repage", original]);
    return;
  }
  const [W, H] = execFileSync("magick", ["identify", "-format", "%w %h", original + "[0]"]).toString().split(" ").map(Number);
  const { x, y, w, h } = pick.crop;
  const geometry = `${Math.round(w * W)}x${Math.round(h * H)}+${Math.round(x * W)}+${Math.round(y * H)}`;
  execFileSync("magick", [original + "[0]", "-crop", geometry, "+repage", original]);
}
/** The labelled fields of an NPGallery asset page ("Title:", "PhotoCredit:", "Constraints Information:", ...). */
function npsFields(html) {
  const decode = (t) => t.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const fields = {};
  for (const m of html.matchAll(/<label[^>]*>\s*([^<]+?)\s*<\/label>\s*<div[^>]*>([\s\S]*?)<\/div>/g)) {
    fields[m[1].replace(/\s+/g, " ").trim()] = decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  }
  return fields;
}
function questionInfos() {
  const out = [];
  for (const v of ["2008", "2025"]) {
    for (const e of read(`data/civics-answers/${v}.json`).entries) out.push({ id: e.id, version: v, text: e.questionText });
  }
  return out;
}

function writeDocs(manifest, mapping, todo) {
  const illustrations = read("data/images/illustrations-manifest.json", { images: [] });
  const diagrams = read("data/images/diagrams-manifest.json", { images: [] });
  const reviewPath = path.join(ROOT, "docs/image-review.md");
  const ownerOk = fs.existsSync(reviewPath) ? parseOwnerOk(fs.readFileSync(reviewPath, "utf8")) : {};
  write("docs/image-credits.md", buildCredits(manifest, mapping, illustrations, diagrams));
  write("docs/image-review.md", buildReview(manifest, mapping, questionInfos(), illustrations, diagrams, ownerOk));
  write("docs/image-todo.md", buildTodo(todo, read("data/images/misses.json", { misses: [] }).misses));
}

/** The files of an item record: the biggest JPEG, or the master TIFF when the JPEGs are small. */
function chooseFile(record) {
  const files = (record.resources?.[0]?.files ?? []).flat();
  const jpegs = files.filter((f) => f.mimetype === "image/jpeg" && !/_150px|_thumb/.test(f.url)).sort((a, b) => b.width - a.width);
  const tiff = files.find((f) => f.mimetype === "image/tiff" && f.size < 60_000_000);
  if (jpegs[0] !== undefined && (jpegs[0].width >= 900 || tiff === undefined)) return jpegs[0];
  return tiff ?? jpegs[0];
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
    const isNara = pick.source === "nara";
    const isNps = pick.source === "nps";
    const pageUrl = isNps ? `https://npgallery.nps.gov/AssetDetail/${pick.npsId}` : isNara ? `https://catalog.archives.gov/id/${pick.naId}` : isSi ? `https://www.si.edu/object/${pick.record}` : `https://www.loc.gov/item/${pick.locItem}/`;
    const fail = (reason) => {
      console.log(`SKIP ${pick.id}: ${reason}`);
      todo.push({ wanted: pick.wanted ?? pick.id, pageUrl, reason });
    };
    const have = built.get(pick.id);
    if (have !== undefined && have.sourcePageUrl === pageUrl && fs.existsSync(path.join(OUT, have.file)) && have.alt === pick.alt && have.caption === (pick.caption ?? have.title) && (pick.date === undefined || have.date === pick.date) && have.edit === editText(pick) && (isSi ? have.rights === `${siRecords.get(pick.record)?.objectRights?.label}: ${siRecords.get(pick.record)?.objectRights?.content}` : true)) {
      images.push(have);
      console.log(`keep ${pick.id}`);
      continue;
    }
    if (!isSi && !isNara && !isNps && blocked) {
      fail("loc.gov blocked this computer (HTTP 429) earlier in this run; not asked again");
      continue;
    }
    try {
      if (isNps) {
        // NPGallery (National Park Service): the asset page's own "Constraints Information" must say
        // Public domain, and the photo credit must be the National Park Service ("NPS", "NPS Photo", "NPS/...").
        const page = (await fetchRetry(pageUrl, true)).toString("utf8");
        const f = npsFields(page);
        const constraint = f["Constraints Information:"] ?? "";
        const credit = f["PhotoCredit:"] ?? "";
        const rights = `Constraints Information: ${constraint}`;
        if (!/^Public domain\b/.test(constraint) || !acceptableRights(rights)) {
          fail(`the NPGallery constraint is not "Public domain": "${constraint}"`);
          continue;
        }
        if (!/^NPS\b/i.test(credit)) {
          fail(`the photo credit is not the National Park Service: "${credit}"`);
          continue;
        }
        if (String(f["Asset ID:"] ?? "").toLowerCase() !== String(pick.npsId).toLowerCase()) {
          fail("the NPGallery page is not the asset named in picks.json");
          continue;
        }
        const fileUrl = `https://npgallery.nps.gov/GetAsset/${pick.npsId}`;
        const data = await fetchRetry(fileUrl, true);
        const sha256 = crypto.createHash("sha256").update(data).digest("hex");
        const original = path.join(TMP, `${pick.id}.jpg`);
        fs.writeFileSync(original, data);
        applyCrop(original, pick);
        const target = path.join(OUT, `${pick.id}.webp`);
        const quality = toWebp(original, target);
        fs.rmSync(original, { force: true });
        if (quality < 0) {
          fs.rmSync(target, { force: true });
          fail("could not get the WebP under 150 kB");
          continue;
        }
        const [w, h] = execFileSync("magick", ["identify", "-format", "%w %h", target]).toString().split(" ").map(Number);
        const title = f["Title:"] ?? pick.id;
        images.push({
          id: pick.id,
          file: `${pick.id}.webp`,
          title,
          creator: `${credit} (National Park Service)`,
          date: pick.date ?? f["Create Date:"] ?? "",
          sourcePageUrl: pageUrl,
          fileUrl,
          rights,
          downloadedOn: new Date().toISOString().slice(0, 10),
          sha256,
          alt: pick.alt,
          caption: pick.caption ?? title,
          ...(editText(pick) !== undefined ? { edit: editText(pick) } : {}),
          width: w,
          height: h,
          bytes: fs.statSync(target).size,
        });
        console.log(`ok   ${pick.id} ${w}x${h} ${fs.statSync(target).size} bytes (q${quality}) [NPS]`);
        continue;
      }
      if (isNara) {
        // National Archives Catalog: the record's own use and access restriction must both be "Unrestricted".
        const found = await fetchRetry(`https://catalog.archives.gov/proxy/records/search?naId=${pick.naId}`);
        const rec = found?.body?.hits?.hits?.[0]?._source?.record;
        if (rec === undefined || String(rec.naId) !== String(pick.naId)) {
          fail("the National Archives Catalog returned no record for this naId");
          continue;
        }
        const use = rec.useRestriction?.status;
        const access = rec.accessRestriction?.status;
        const rights = `Use restriction: ${use}. Access restriction: ${access}.`;
        if (use !== "Unrestricted" || access !== "Unrestricted" || rec.useRestriction?.specificUseRestrictions !== undefined || !acceptableRights(rights)) {
          fail(`use or access restriction is not "Unrestricted": "${rights}"`);
          continue;
        }
        const objects = (rec.digitalObjects ?? []).filter((o) => /^Image \((JPG|JPEG|TIFF)\)$/i.test(o.objectType ?? ""));
        const object = pick.file !== undefined ? objects.find((o) => o.objectUrl === pick.file) : objects.find((o) => (o.objectFileSize ?? 0) > 1_000_000);
        if (object === undefined) {
          fail("the record lists no large JPEG or TIFF file (or not the one named in picks.json)");
          continue;
        }
        const data = await fetchRetry(object.objectUrl, true);
        const sha256 = crypto.createHash("sha256").update(data).digest("hex");
        const original = path.join(TMP, `${pick.id}${path.extname(new URL(object.objectUrl).pathname).toLowerCase()}`);
        fs.writeFileSync(original, data);
        const target = path.join(OUT, `${pick.id}.webp`);
        const quality = toWebp(original, target);
        fs.rmSync(original, { force: true });
        if (quality < 0) {
          fs.rmSync(target, { force: true });
          fail("could not get the WebP under 150 kB");
          continue;
        }
        const [w, h] = execFileSync("magick", ["identify", "-format", "%w %h", target]).toString().split(" ").map(Number);
        const people = (rec.contributors ?? []).map((c) => `${c.heading} (${c.contributorType})`);
        const agency = (rec.ancestors ?? []).find((a) => a.levelOfDescription === "recordGroup")?.title;
        const creator = [...people, agency].filter(Boolean).join("; ") || "Unknown";
        const d = rec.productionDates?.[0] ?? rec.coverageStartDate ?? rec.inclusiveStartDate;
        const date = pick.date ?? (d?.logicalDate ?? (d?.year !== undefined ? String(d.year) : ""));
        images.push({
          id: pick.id,
          file: `${pick.id}.webp`,
          title: String(rec.title).trim(),
          creator,
          date,
          sourcePageUrl: pageUrl,
          fileUrl: object.objectUrl,
          rights,
          downloadedOn: new Date().toISOString().slice(0, 10),
          sha256,
          alt: pick.alt,
          caption: pick.caption ?? String(rec.title).trim(),
          width: w,
          height: h,
          bytes: fs.statSync(target).size,
        });
        console.log(`ok   ${pick.id} ${w}x${h} ${fs.statSync(target).size} bytes (q${quality}) [National Archives]`);
        continue;
      }
      if (isSi) {
        // Smithsonian Open Access: the rights statement is the record's own usage access ("CC0").
        const rec = siRecords.get(pick.record);
        if (rec === undefined) {
          fail("no Smithsonian record snapshot in data/images/si-records.json");
          continue;
        }
        // The record's own "Restrictions & Rights" field, as it is; the media usage access must say CC0 too.
        const rights = `${rec.objectRights.label}: ${rec.objectRights.content}`;
        if (rec.mediaAccess !== "CC0" || rec.objectRights.content !== "CC0" || !acceptableRights(rights)) {
          fail(`rights statement is not CC0: "${rights}", media "${rec.mediaAccess}"`);
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
          caption: pick.caption ?? rec.title,
          width: w,
          height: h,
          bytes: fs.statSync(target).size,
        });
        console.log(`ok   ${pick.id} ${w}x${h} ${fs.statSync(target).size} bytes (q${quality}) [Smithsonian]`);
        continue;
      }
      const record = await fetchRetry(`${pageUrl}?fo=json`);
      const item = record.item;
      // Some records give the statement as a one-item list: use its text as it is.
      const rawRights = item.rights_advisory ?? item.rights_information ?? "";
      const rights = Array.isArray(rawRights) ? rawRights.join(" ") : rawRights;
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
      // A stereograph card holds two nearly identical photos side by side; a print can carry a printed caption: crop as the pick says.
      applyCrop(original, pick);
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
        caption: pick.caption ?? String(item.title).trim(),
        ...(editText(pick) !== undefined ? { edit: editText(pick) } : {}),
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
