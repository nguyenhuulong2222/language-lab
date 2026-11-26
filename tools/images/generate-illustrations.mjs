#!/usr/bin/env node
/**
 * tools/images/generate-illustrations.mjs
 *
 * Makes the AI illustrations for CONCEPT civics questions from data/images/illustration-prompts.json.
 *
 *   node --no-warnings tools/images/generate-illustrations.mjs              dry run (the default):
 *                                                                          print every prompt and the cost estimate
 *   node --no-warnings tools/images/generate-illustrations.mjs --run        generate (paid API calls)
 *   node --no-warnings tools/images/generate-illustrations.mjs --run --only=rule-of-law,three-branches
 *
 * --run needs OPENAI_API_KEY in the environment. The key is read from the environment only: never
 * from a file, never printed, never written anywhere.
 *
 * Each picture is saved as WebP (longest side 1200px, about 150 kB or less) in
 * public/images/illustrations/, and data/images/illustrations-manifest.json gets an entry with the
 * id, file, model, the full prompt, the date, the SHA-256 of what the API returned, alt text,
 * caption, source "ai" and reviewed: false. The app shows an illustration only after the owner
 * looks at it and sets reviewed to true. An entry whose prompt and model are unchanged is kept as
 * it is (with its reviewed flag); a changed prompt is made again and starts unreviewed.
 *
 * Developer tool for the owner. Not part of `npm test`. Needs ImageMagick (`magick`).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkIllustrationData, composePrompt, estimateCost } from "../../src/engine/illustrations.ts";
import { imageSize, toWebp } from "./webp.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "public/images/illustrations");
const TMP = path.join(os.tmpdir(), "language-lab-illustrations");
const MANIFEST = "data/images/illustrations-manifest.json";
const ENDPOINT = "https://api.openai.com/v1/images/generations";
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const args = process.argv.slice(2);
const run = args.includes("--run");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",").filter(Boolean);
const file = read("data/images/illustration-prompts.json");
const manifest = read(MANIFEST);
const classes = read("data/images/question-classes.json");
const questions = ["2008", "2025"].flatMap((v) => read(`data/civics-answers/${v}.json`).entries.map((e) => ({ id: e.id, answerType: e.answerType })));
const files = new Set(fs.existsSync(OUT) ? fs.readdirSync(OUT) : []);
// Refuse to run on prompts that break a rule (a prompt for a non-CONCEPT question, a missing rules line, ...).
const problems = checkIllustrationData({ prompts: file, manifest, classes, questions, files });
if (problems.length > 0) {
  for (const p of problems) console.error(`PROBLEM ${p.where}: ${p.problem}`);
  process.exit(1);
}
const selected = file.prompts.filter((p) => only === undefined || only.includes(p.id));
if (only !== undefined && selected.length !== only.length) {
  console.error(`Unknown prompt id in --only: ${only.filter((id) => !file.prompts.some((p) => p.id === id)).join(", ")}`);
  process.exit(1);
}
const existing = new Map(manifest.images.map((e) => [e.id, e]));
const todo = selected.filter((p) => {
  const have = existing.get(p.id);
  return !(have !== undefined && have.prompt === composePrompt(file, p) && have.model === file.model && files.has(have.file));
});
const cost = estimateCost({ estimate: file.estimate, prompts: todo });
console.log(`Model: ${file.model}, size ${file.size}, quality ${file.quality}`);
console.log(`Prompts: ${file.prompts.length} in the file, ${selected.length} selected, ${todo.length} to make (the rest are already made with the same prompt).`);
console.log("");
for (const p of todo) {
  console.log(`--- ${p.id} (questions ${p.questions.join(", ")})`);
  console.log(composePrompt(file, p));
  console.log(`alt: ${p.alt}`);
  console.log(`caption: ${p.caption}`);
  console.log("");
}
console.log(`Estimated cost: ${cost.count} images x $${cost.usdPerImage.toFixed(3)} = about $${cost.totalUsd.toFixed(2)}`);
console.log(`Basis: ${file.estimate.basis}`);
if (!run) {
  console.log("");
  console.log("Dry run: nothing was sent. Add --run to generate (paid API calls).");
  process.exit(0);
}
const key = process.env.OPENAI_API_KEY;
if (typeof key !== "string" || key.trim() === "") {
  console.error("OPENAI_API_KEY is not set in the environment. Nothing was sent.");
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
const writeManifest = () => fs.writeFileSync(path.join(ROOT, MANIFEST), JSON.stringify(manifest, null, 1) + "\n");
for (const p of todo) {
  const prompt = composePrompt(file, p);
  process.stdout.write(`make ${p.id} ... `);
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: file.model, prompt, size: file.size, quality: file.quality, output_format: "png", n: 1 }),
      signal: AbortSignal.timeout(240_000),
    });
  } catch (e) {
    console.log(`failed: ${e.message}`);
    continue;
  }
  if (!res.ok) {
    // The error body never contains the key; print only its message.
    const body = await res.json().catch(() => ({}));
    console.log(`failed: HTTP ${res.status} ${body?.error?.message ?? ""}`);
    if (res.status === 401 || res.status === 429) break;
    continue;
  }
  const b64 = (await res.json())?.data?.[0]?.b64_json;
  if (typeof b64 !== "string") {
    console.log("failed: no image in the response");
    continue;
  }
  const data = Buffer.from(b64, "base64");
  const sha256 = crypto.createHash("sha256").update(data).digest("hex");
  const original = path.join(TMP, `${p.id}.png`);
  fs.writeFileSync(original, data);
  const target = path.join(OUT, `${p.id}.webp`);
  const quality = toWebp(original, target);
  fs.rmSync(original, { force: true });
  if (quality < 0) {
    fs.rmSync(target, { force: true });
    console.log("failed: could not get the WebP under 150 kB");
    continue;
  }
  const [width, height] = imageSize(target);
  const entry = {
    id: p.id,
    file: `${p.id}.webp`,
    questions: p.questions,
    model: file.model,
    prompt,
    date: new Date().toISOString().slice(0, 10),
    sha256,
    alt: p.alt,
    caption: p.caption,
    source: "ai",
    reviewed: false,
    width,
    height,
    bytes: fs.statSync(target).size,
  };
  const at = manifest.images.findIndex((e) => e.id === p.id);
  if (at >= 0) manifest.images[at] = entry;
  else manifest.images.push(entry);
  writeManifest();
  console.log(`ok ${width}x${height} ${entry.bytes} bytes (q${quality}), reviewed: false`);
}
console.log("");
console.log("Look at every new picture, then set reviewed to true in data/images/illustrations-manifest.json for each one you approve.");
console.log("Then run: node --no-warnings tools/images/build-images.mjs --docs");
