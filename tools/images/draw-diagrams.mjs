#!/usr/bin/env node
/**
 * tools/images/draw-diagrams.mjs
 *
 * Draws the "diagram" pictures (kind "diagram") from U.S. federal data and the U.S. flag code:
 *
 *   us-flag-50                 4 U.S.C. §§ 1-2 and Executive Order 10834 proportions (tools/images/flag.mjs)
 *   thirteen-original-states   U.S. Census Bureau cartographic boundary file, states 1:20,000,000 (2023)
 *   longest-rivers             the same states, plus the Missouri and Mississippi rivers from the
 *                              USGS National Atlas "1:1,000,000-Scale Streams of the United States"
 *   atlantic-coast, pacific-coast, canada-border-states, mexico-border-states
 *   us-territories             the 1:20m states plus the four small territories from the 1:500,000 file
 *
 * One base style in the formN400 palette (navy #0d2052, red #b22234, background #f7f8fc, border
 * #dde2ef). No text labels: only highlights.
 *
 * Source data is downloaded once (federal URLs only). What is kept in data/images/sources/:
 *   - the 1:20m state archive itself (186 kB);
 *   - from the 1:500k archive (3.2 MB) only the four small territories, as GeoJSON;
 *   - from the USGS archive (240 MB) only the Missouri and Mississippi river lines, as GeoJSON.
 * data/images/sources/sources.json records each archive's URL, download date and SHA-256, and the
 * SHA-256 of every kept file. A second run uses the kept files and downloads nothing.
 *
 * Output: public/images/diagrams/<id>.webp (longest side 1200 px, about 145 kB or less) and
 * data/images/diagrams-manifest.json. An entry keeps reviewed: true only while its file is unchanged;
 * a redrawn file starts unreviewed. The app shows a diagram only when reviewed is true.
 *
 *   node --no-warnings tools/images/draw-diagrams.mjs
 *
 * Needs ImageMagick (`magick`) for the WebP step. Developer tool, not part of `npm test`.
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { geoConicEqualArea, geoEquirectangular, geoPath } from "d3-geo";
import * as shapefile from "shapefile";
import { flagShapes, flagSvg } from "./flag.mjs";
import { imageSize, toWebp } from "./webp.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "data/images/sources");
const OUT = path.join(ROOT, "public/images/diagrams");
const TMP = path.join(os.tmpdir(), "language-lab-diagrams");
const MANIFEST = path.join(ROOT, "data/images/diagrams-manifest.json");
const UA = "LanguageLabResearch/1.0 (practice tool; federal map data)";
const today = new Date().toISOString().slice(0, 10);
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const NAVY = "#0d2052";
const RED = "#b22234";
const BG = "#f7f8fc";
const BORDER = "#dde2ef";
fs.mkdirSync(SRC, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

// ---------------------------------------------------------------- source data
const SOURCES_FILE = path.join(SRC, "sources.json");
const sources = fs.existsSync(SOURCES_FILE) ? JSON.parse(fs.readFileSync(SOURCES_FILE, "utf8")) : { _note: "", sources: [] };
sources._note =
  "Federal source data for tools/images/draw-diagrams.mjs. sha256 is of the archive as downloaded from url; keptSha256 is of the file kept in this folder. Written by the tool.";
const ARCHIVES = [
  {
    id: "census-cb-2023-states-20m",
    publisher: "U.S. Census Bureau",
    title: "Cartographic Boundary File, States, 1:20,000,000 (2023), shapefile",
    url: "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_20m.zip",
    kept: "cb_2023_us_state_20m.zip",
    keptNote: "the archive itself",
  },
  {
    id: "census-cb-2023-states-500k",
    publisher: "U.S. Census Bureau",
    title: "Cartographic Boundary File, States, 1:500,000 (2023), shapefile",
    url: "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip",
    kept: "census-cb-2023-territories-500k.geojson",
    keptNote: "only American Samoa, Guam, the Northern Mariana Islands and the U.S. Virgin Islands (STUSPS AS, GU, MP, VI), coordinates rounded to 4 decimals",
  },
  {
    id: "usgs-national-atlas-streaml010g",
    publisher: "U.S. Geological Survey, National Atlas of the United States",
    title: "1:1,000,000-Scale Streams of the United States, edition 2 (streaml010g), shapefile",
    url: "https://prd-tnm.s3.amazonaws.com/StagedProducts/Small-scale/data/Hydrography/streaml010g.shp_nt00885.tar.gz",
    kept: "usgs-streaml010g-missouri-mississippi.geojson",
    keptNote: 'only the stream lines whose Name is "Missouri River" or "Mississippi River", coordinates rounded to 3 decimals',
  },
];
async function download(url) {
  if (!/^https:\/\/(www2\.census\.gov|prd-tnm\.s3\.amazonaws\.com)\//.test(url)) throw new Error(`not an allowed federal data URL: ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(600_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
const round3 = (line) => line.map(([x, y]) => [Math.round(x * 1e3) / 1e3, Math.round(y * 1e3) / 1e3]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
const round = (c) => (typeof c[0] === "number" ? c.map((v) => Math.round(v * 1e4) / 1e4) : c.map(round));
function readUseConstraints(file) {
  const text = fs.readFileSync(file, "utf8");
  const m = text.match(/Access_Constraints:[\s\S]*?(?=\n\s*Point_of_Contact:)/);
  return m ? m[0].replace(/\s+/g, " ").trim() : null;
}
async function ensureSources() {
  for (const a of ARCHIVES) {
    const rec = sources.sources.find((s) => s.id === a.id);
    const keptPath = path.join(SRC, a.kept);
    if (rec !== undefined && fs.existsSync(keptPath) && sha(fs.readFileSync(keptPath)) === rec.keptSha256) {
      console.log(`have ${a.id}`);
      continue;
    }
    console.log(`download ${a.url}`);
    const data = await download(a.url);
    const archive = path.join(TMP, path.basename(new URL(a.url).pathname));
    fs.writeFileSync(archive, data);
    const dir = path.join(TMP, a.id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    let rights = null;
    if (a.id === "census-cb-2023-states-20m") {
      fs.copyFileSync(archive, keptPath);
    } else if (a.id === "census-cb-2023-states-500k") {
      execFileSync("unzip", ["-o", "-q", archive, "-d", dir]);
      const g = await shapefile.read(path.join(dir, "cb_2023_us_state_500k.shp"), path.join(dir, "cb_2023_us_state_500k.dbf"));
      const features = g.features
        .filter((f) => ["AS", "GU", "MP", "VI"].includes(f.properties.STUSPS))
        .map((f) => ({ type: "Feature", properties: { STUSPS: f.properties.STUSPS, NAME: f.properties.NAME }, geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) } }));
      fs.writeFileSync(keptPath, JSON.stringify({ type: "FeatureCollection", features }) + "\n");
    } else {
      execFileSync("tar", ["xzf", archive, "-C", dir]);
      rights = readUseConstraints(path.join(dir, "streaml010g.txt"));
      // 1.1 million lines: stream them instead of reading the whole file at once.
      const src = await shapefile.open(path.join(dir, "streaml010g.shp"), path.join(dir, "streaml010g.dbf"));
      const lines = { "Missouri River": [], "Mississippi River": [] };
      for (let r = await src.read(); !r.done; r = await src.read()) {
        const name = r.value.properties.Name;
        if (!(name in lines)) continue;
        const parts = r.value.geometry.type === "LineString" ? [r.value.geometry.coordinates] : r.value.geometry.coordinates;
        for (const part of parts) lines[name].push(round3(part));
      }
      const features = Object.entries(lines).map(([NAME, coordinates]) => ({ type: "Feature", properties: { NAME }, geometry: { type: "MultiLineString", coordinates } }));
      fs.writeFileSync(keptPath, JSON.stringify({ type: "FeatureCollection", features }) + "\n");
    }
    const entry = {
      id: a.id,
      publisher: a.publisher,
      title: a.title,
      url: a.url,
      downloadedOn: today,
      sha256: sha(data),
      bytes: data.length,
      kept: `data/images/sources/${a.kept}`,
      keptNote: a.keptNote,
      keptSha256: sha(fs.readFileSync(keptPath)),
      ...(rights !== null ? { useConstraints: rights } : {}),
    };
    sources.sources = [...sources.sources.filter((s) => s.id !== a.id), entry];
    fs.rmSync(archive, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
  sources.sources = sources.sources.filter((s) => ARCHIVES.some((a) => a.id === s.id));
  sources.sources.sort((x, y) => ARCHIVES.findIndex((a) => a.id === x.id) - ARCHIVES.findIndex((a) => a.id === y.id));
  fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 1) + "\n");
}
async function loadStates() {
  const dir = path.join(TMP, "states-20m");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("unzip", ["-o", "-q", path.join(SRC, "cb_2023_us_state_20m.zip"), "-d", dir]);
  const g = await shapefile.read(path.join(dir, "cb_2023_us_state_20m.shp"), path.join(dir, "cb_2023_us_state_20m.dbf"));
  fs.rmSync(dir, { recursive: true, force: true });
  return g.features;
}

// ---------------------------------------------------------------- drawing
const W = 1200;
function svgDoc(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${BG}"/>${body}</svg>`;
}
const fc = (features) => ({ type: "FeatureCollection", features });
function statePaths(features, pathGen, highlight = new Set()) {
  const base = [];
  const hi = [];
  for (const f of features) {
    const d = pathGen(f);
    if (!d) continue;
    if (highlight.has(f.properties.STUSPS)) hi.push(`<path d="${d}" fill="${RED}" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>`);
    else base.push(`<path d="${d}" fill="${BORDER}" stroke="${NAVY}" stroke-opacity="0.45" stroke-width="0.9" stroke-linejoin="round"/>`);
  }
  return base.join("") + hi.join("");
}
/** Ring segments that belong to one state only: coasts and international borders. */
function outerSegments(features, keep) {
  const key = (a, b) => (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? `${a}|${b}` : `${b}|${a}`);
  const count = new Map();
  const rings = [];
  for (const f of features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) for (const ring of poly) rings.push({ st: f.properties.STUSPS, ring });
  }
  for (const { ring } of rings) for (let i = 1; i < ring.length; i++) count.set(key(ring[i - 1], ring[i]), (count.get(key(ring[i - 1], ring[i])) ?? 0) + 1);
  const lines = [];
  for (const { st, ring } of rings) {
    let cur = [];
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1];
      const b = ring[i];
      const ok = count.get(key(a, b)) === 1 && keep(st, a) && keep(st, b);
      if (ok) {
        if (cur.length === 0) cur.push(a);
        cur.push(b);
      } else if (cur.length > 1) {
        lines.push(cur);
        cur = [];
      } else cur = [];
    }
    if (cur.length > 1) lines.push(cur);
  }
  return { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: lines } };
}
function lower48(states) {
  return states.filter((f) => !["AK", "HI", "PR"].includes(f.properties.STUSPS));
}
function albers(fitTo, width, height, pad = 24) {
  return geoConicEqualArea().parallels([29.5, 45.5]).rotate([96, 0]).fitExtent([[pad, pad], [width - pad, height - pad]], fitTo);
}
/** A soft band of water along a coast: a wide navy stroke, masked so it never covers land. */
function waterBand(coast, land, pathGen, width, height, id) {
  const landD = land.map((f) => pathGen(f)).filter(Boolean).join("");
  return (
    `<defs><mask id="${id}"><rect width="${width}" height="${height}" fill="#ffffff"/><path d="${landD}" fill="#000000"/></mask></defs>` +
    `<g mask="url(#${id})"><path d="${pathGen(coast)}" fill="none" stroke="${NAVY}" stroke-opacity="0.7" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/></g>`
  );
}
const ORIGINAL_13 = ["NH", "MA", "RI", "CT", "NY", "NJ", "PA", "DE", "MD", "VA", "NC", "SC", "GA"];
const CANADA = ["ME", "NH", "VT", "NY", "PA", "OH", "MI", "MN", "ND", "MT", "ID", "WA", "AK"];
const MEXICO = ["CA", "AZ", "NM", "TX"];
const ATLANTIC = ["ME", "NH", "MA", "RI", "CT", "NY", "NJ", "DE", "MD", "VA", "NC", "SC", "GA", "FL"];
function atlanticKeep(st, [lon, lat]) {
  if (!ATLANTIC.includes(st)) return false;
  if (st === "ME") return lat < 44.95;
  if (st === "NH") return lat < 43.2;
  if (st === "NY") return lat < 41.2;
  if (st === "FL") return lon > -80.9 || (lat > 29.6 && lon > -81.7);
  return true;
}
function pacificKeep(st, [lon, lat]) {
  if (!["CA", "OR", "WA"].includes(st)) return false;
  if (lon > -117.13) return false; // the Mexico border east of San Diego
  if (st === "WA" && lat >= 48.99 && lon > -123.3) return false; // the land border with Canada
  return true;
}
function drawMap(id, states, territories, rivers) {
  const l48 = lower48(states);
  if (id === "thirteen-original-states") {
    const focus = fc(states.filter((f) => ORIGINAL_13.includes(f.properties.STUSPS)));
    const width = 900;
    const height = 1200;
    const proj = albers(focus, width, height, 40);
    const p = geoPath(proj);
    return { width, height, svg: svgDoc(width, height, statePaths(l48, p, new Set(ORIGINAL_13))) };
  }
  if (id === "us-territories") {
    const all = [...states, ...territories];
    const width = W;
    const height = 640;
    const proj = geoEquirectangular().rotate([140, 0]).fitExtent([[30, 30], [width - 30, height - 30]], fc(all));
    const p = geoPath(proj);
    const terr = new Set(["PR", "AS", "GU", "MP", "VI"]);
    const rings = [];
    for (const f of all.filter((x) => terr.has(x.properties.STUSPS))) {
      // The islands are a few pixels wide at this scale: mark each with a dot and a ring.
      const [cx, cy] = p.centroid(f);
      rings.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="${RED}"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="15" fill="none" stroke="${RED}" stroke-width="3.5"/>`);
    }
    return { width, height, svg: svgDoc(width, height, statePaths(all, p, terr) + rings.join("")) };
  }
  if (id === "canada-border-states") {
    const set = states.filter((f) => !["HI", "PR"].includes(f.properties.STUSPS));
    const width = W;
    const height = 860;
    const proj = geoConicEqualArea().parallels([40, 62]).rotate([115, 0]).fitExtent([[24, 24], [width - 24, height - 24]], fc(set));
    const p = geoPath(proj);
    return { width, height, svg: svgDoc(width, height, statePaths(set, p, new Set(CANADA))) };
  }
  const width = W;
  const height = 760;
  const proj = albers(fc(l48), width, height, 50);
  const p = geoPath(proj);
  if (id === "mexico-border-states") return { width, height, svg: svgDoc(width, height, statePaths(l48, p, new Set(MEXICO))) };
  if (id === "longest-rivers") {
    const lines = rivers.map((f) => `<path d="${p(f)}" fill="none" stroke="${RED}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
    return { width, height, svg: svgDoc(width, height, statePaths(l48, p) + lines) };
  }
  if (id === "atlantic-coast" || id === "pacific-coast") {
    const coast = outerSegments(l48, id === "atlantic-coast" ? atlanticKeep : pacificKeep);
    return { width, height, svg: svgDoc(width, height, waterBand(coast, l48, p, width, height, "land") + statePaths(l48, p)) };
  }
  throw new Error(`unknown diagram ${id}`);
}

// ---------------------------------------------------------------- the set
const CENSUS = ["census-cb-2023-states-20m"];
const DIAGRAMS = [
  {
    id: "us-flag-50",
    questions: ["2008-097", "2025-122"],
    title: "The 50-star flag of the United States",
    alt: "The U.S. flag: thirteen red and white stripes and a blue field with fifty white stars.",
    caption: "The U.S. flag, with fifty stars",
    creditLine: "Drawn from the U.S. flag code (4 U.S.C. §§ 1-2) and Executive Order 10834",
    sources: [],
    basis: ["4 U.S.C. § 1 and § 2 (https://www.govinfo.gov/content/pkg/USCODE-2023-title4/html/USCODE-2023-title4-chap1.htm)", "Executive Order 10834 of August 21, 1959 (https://www.archives.gov/federal-register/codification/executive-order/10834.html)"],
  },
  {
    id: "thirteen-original-states",
    questions: ["2008-064", "2025-081"],
    title: "The 13 original states, shown with today's state borders",
    alt: "A map of the eastern United States with the thirteen original states in red, from New Hampshire down to Georgia, drawn with today's state borders.",
    caption: "The 13 original states (today's state borders)",
    creditLine: "Drawn from U.S. Census Bureau data",
    sources: CENSUS,
  },
  {
    id: "longest-rivers",
    questions: ["2008-088"],
    title: "The Missouri and Mississippi rivers",
    alt: "A map of the United States with two long rivers drawn in red: one from Montana to Missouri, and one from Minnesota down to the Gulf of Mexico.",
    caption: "The two longest rivers",
    creditLine: "Drawn from USGS National Atlas and U.S. Census Bureau data",
    sources: [...CENSUS, "usgs-national-atlas-streaml010g"],
  },
  {
    id: "pacific-coast",
    questions: ["2008-089"],
    title: "The ocean on the West Coast",
    alt: "A map of the United States with the ocean along the West Coast shaded in dark blue.",
    caption: "The ocean on the West Coast",
    creditLine: "Drawn from U.S. Census Bureau data",
    sources: CENSUS,
  },
  {
    id: "atlantic-coast",
    questions: ["2008-090"],
    title: "The ocean on the East Coast",
    alt: "A map of the United States with the ocean along the East Coast shaded in dark blue.",
    caption: "The ocean on the East Coast",
    creditLine: "Drawn from U.S. Census Bureau data",
    sources: CENSUS,
  },
  {
    id: "us-territories",
    questions: ["2008-091"],
    title: "The U.S. territories",
    alt: "A wide map of the Pacific and the United States. Five small island territories are in red and circled: two in the Caribbean and three in the Pacific.",
    caption: "The five U.S. territories, circled",
    creditLine: "Drawn from U.S. Census Bureau data",
    sources: [...CENSUS, "census-cb-2023-states-500k"],
  },
  {
    id: "canada-border-states",
    questions: ["2008-092"],
    title: "The states that border Canada",
    alt: "A map of the United States including Alaska, with the thirteen states along the northern border in red.",
    caption: "States on the border with Canada",
    creditLine: "Drawn from U.S. Census Bureau data",
    sources: CENSUS,
  },
  {
    id: "mexico-border-states",
    questions: ["2008-093"],
    title: "The states that border Mexico",
    alt: "A map of the United States with the four states along the southern border in red, from California to Texas.",
    caption: "States on the border with Mexico",
    creditLine: "Drawn from U.S. Census Bureau data",
    sources: CENSUS,
  },
];
const LEGAL_BASIS = "U.S. Government work, public domain (17 U.S.C. §105)";

await ensureSources();
const states = await loadStates();
const territories = JSON.parse(fs.readFileSync(path.join(SRC, "census-cb-2023-territories-500k.geojson"), "utf8")).features;
const rivers = JSON.parse(fs.readFileSync(path.join(SRC, "usgs-streaml010g-missouri-mississippi.geojson"), "utf8")).features;
const old = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")).images : [];
const images = [];
for (const d of DIAGRAMS) {
  const drawn = d.id === "us-flag-50" ? { svg: flagSvg(600) } : drawMap(d.id, states, territories, rivers);
  const png = new Resvg(drawn.svg, { fitTo: { mode: "width", value: Math.min(1200, drawn.width ?? 1140) } }).render().asPng();
  const input = path.join(TMP, `${d.id}.png`);
  fs.writeFileSync(input, png);
  const target = path.join(OUT, `${d.id}.webp`);
  const quality = toWebp(input, target);
  fs.rmSync(input, { force: true });
  if (quality < 0) throw new Error(`${d.id}: could not get the WebP under 150 kB`);
  const [width, height] = imageSize(target);
  const file = fs.readFileSync(target);
  const prev = old.find((e) => e.id === d.id);
  const fileSha = sha(file);
  const counts = d.id === "us-flag-50" ? { stars: flagShapes().stars.length, stripes: flagShapes().stripes.length } : undefined;
  images.push({
    id: d.id,
    kind: "diagram",
    file: `${d.id}.webp`,
    questions: d.questions,
    title: d.title,
    alt: d.alt,
    caption: d.caption,
    creditLine: d.creditLine,
    legalBasis: LEGAL_BASIS,
    sources: d.sources.map((sid) => {
      const s = sources.sources.find((x) => x.id === sid);
      return { id: s.id, publisher: s.publisher, url: s.url, downloadedOn: s.downloadedOn, sha256: s.sha256 };
    }),
    ...(d.basis !== undefined ? { drawnFrom: d.basis } : {}),
    ...(counts !== undefined ? { counts } : {}),
    drawnOn: prev !== undefined && prev.sha256 === fileSha ? prev.drawnOn : today,
    sha256: fileSha,
    width,
    height,
    bytes: file.length,
    reviewed: prev !== undefined && prev.sha256 === fileSha ? prev.reviewed === true : false,
  });
  console.log(`ok   ${d.id} ${width}x${height} ${file.length} bytes (q${quality})${prev?.sha256 === fileSha ? " unchanged" : ""}`);
}
for (const f of fs.readdirSync(OUT)) if (!images.some((e) => e.file === f)) fs.rmSync(path.join(OUT, f));
fs.writeFileSync(
  MANIFEST,
  JSON.stringify(
    {
      _note: "Diagrams drawn by tools/images/draw-diagrams.mjs from federal data and the U.S. flag code. Shown in the app only when reviewed is true. Do not edit by hand except the reviewed flag.",
      images,
    },
    null,
    1
  ) + "\n"
);
console.log(`Done. ${images.length} diagrams in public/images/diagrams/.`);
