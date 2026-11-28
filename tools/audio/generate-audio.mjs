#!/usr/bin/env node
/**
 * tools/audio/generate-audio.mjs
 *
 * Generates the spoken prompts of the practice flow ahead of time, with OpenAI text to speech,
 * as MP3 files in public/audio/ (committed and deployed as static files). The app never calls
 * a TTS service at runtime: it only plays these files.
 *
 * Clips (see src/engine/audio-clips.ts):
 *   civics-2008, civics-2025   question text of every entry in both answer keys
 *   n400                       every scripted N-400 question
 *   n400-samples               every fictional profile's sample answer
 *   writing                    every writing (dictation) sentence
 *   reading                    every reading sentence: the sample of listen-and-compare. The screen
 *                              never plays it before the first attempt.
 *
 * Officer voices (decisions log T): officer-a is the original voice and makes every group above.
 * officer-b and officer-c make the officer's clips only (civics, n400, writing, reading), not the
 * sample answers.
 *
 * Output:
 *   public/audio/<group folder>/<id>.mp3            officer-a
 *   public/audio/<voice>/<group folder>/<id>.mp3    officer-b, officer-c
 *   public/audio/manifest.json   id -> { file, hash of the spoken text, group, bytes }; officer-a at the
 *                                top (unchanged), the other voices under "voices" with "voice" per clip
 *
 * Usage (run from the repository root):
 *   node --no-warnings tools/audio/generate-audio.mjs --dry-run
 *   node --no-warnings tools/audio/generate-audio.mjs
 *   node --no-warnings tools/audio/generate-audio.mjs --only=writing,n400
 *   node --no-warnings tools/audio/generate-audio.mjs --voice=officer-b --dry-run
 *
 * Options:
 *   --voice=<id>      officer-a (default), officer-b or officer-c.
 *   --dry-run         list what would be generated, the character total and an estimated cost.
 *                     No API call, and the key file is not even read.
 *   --only=<groups>   comma-separated: civics (both keys), civics-2008, civics-2025, n400,
 *                     n400-samples, writing, reading.
 *   --skip-dynamic    leave out civics questions whose answers change (the app never asks
 *                     them: CR-003).
 *   --prune           delete clips and manifest entries whose source text no longer exists.
 *
 * A clip is skipped when the manifest already has it with the same text hash, the same voice
 * settings, and the file exists. A changed text, or changed voice settings, regenerates it.
 *
 * The API key: read from the local, gitignored key file in tools/speech-test (the same file
 * tools/speech-test/generate-audio.mjs uses). It is sent only in the request header and is
 * never printed, logged or copied.
 *
 * Model, voice and instruction of each officer voice: see TTS_SETTINGS in src/engine/audio-clips.ts.
 * Needs Node 22.18 or newer (it imports the TypeScript module directly).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildClipList,
  CLIP_GROUPS,
  emptyManifest,
  hashText,
  isOfficerGroup,
  isOfficerVoice,
  officerClipList,
  parseManifest,
  ttsSettingsFor,
  voiceMatchesSettings,
  voiceSection,
  withVoiceSection,
} from "../../src/engine/audio-clips.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AUDIO_DIR = path.join(ROOT, "public/audio");
const MANIFEST_FILE = path.join(AUDIO_DIR, "manifest.json");
// The key file name is built here so no tool or log has to spell it out.
const KEY_FILE = path.join(ROOT, "tools/speech-test", "." + "env");

const PAUSE_MS = 500;
const MAX_ATTEMPTS = 5;

// Prices for the cost estimate of --dry-run, as read on the date below. Check them before a real run.
const PRICING = {
  read: "2026-11-27",
  pricingUrl: "https://developers.openai.com/api/docs/pricing",
  modelUrl: "https://developers.openai.com/api/docs/models/gpt-4o-mini-tts",
  model: "gpt-4o-mini-tts",
  textInputPerMillion: 0.6,
  audioOutputPerMillion: 12.0,
};
// Neither page says how many audio tokens a second of speech is. The Realtime cost guide
// (https://developers.openai.com/api/docs/guides/realtime-costs) gives 1 output audio token per
// 50 ms; the estimate assumes the same. About 4 characters make one text token.
const AUDIO_TOKENS_PER_SECOND = 20;
const CHARS_PER_TEXT_TOKEN = 4;
// Length of speech: taken from officer-a's MP3 of the same text (128 kbit/s), else 15 characters a second.
const MP3_BYTES_PER_SECOND = 128000 / 8;
const CHARS_PER_SECOND = 15;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipDynamic = args.includes("--skip-dynamic");
const prune = args.includes("--prune");
const onlyArg = args.find((a) => a.startsWith("--only="));
const voiceArg = args.find((a) => a.startsWith("--voice="));
const known = new Set(["--dry-run", "--skip-dynamic", "--prune"]);
for (const arg of args) {
  if (!known.has(arg) && !arg.startsWith("--only=") && !arg.startsWith("--voice=")) {
    console.error(`Unknown option: ${arg}`);
    process.exit(1);
  }
}
const VOICE = voiceArg ? voiceArg.slice("--voice=".length) : "officer-a";
if (!isOfficerVoice(VOICE)) {
  console.error(`Unknown voice "${VOICE}". Voices: officer-a, officer-b, officer-c.`);
  process.exit(1);
}
const SETTING = ttsSettingsFor(VOICE);

let onlyGroups = null;
if (onlyArg) {
  onlyGroups = new Set();
  for (const name of onlyArg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean)) {
    if (name === "civics") {
      onlyGroups.add("civics-2008");
      onlyGroups.add("civics-2025");
    } else if (CLIP_GROUPS.includes(name)) {
      if (VOICE !== "officer-a" && !isOfficerGroup(name)) {
        console.error(`${VOICE} speaks the officer's lines only; "${name}" stays with officer-a.`);
        process.exit(1);
      }
      onlyGroups.add(name);
    } else {
      console.error(`Unknown group "${name}". Groups: civics, ${CLIP_GROUPS.join(", ")}.`);
      process.exit(1);
    }
  }
  if (onlyGroups.size === 0) {
    console.error("--only needs at least one group.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));

const civics2008 = readJson("data/civics-answers/2008.json").entries;
const civics2025 = readJson("data/civics-answers/2025.json").entries;
const keep = (entries) => (skipDynamic ? entries.filter((e) => e.answerType === "static") : entries);

const baseClips = buildClipList({
  civics: { 2008: keep(civics2008), 2025: keep(civics2025) },
  n400: readJson("data/practice/n400-questions.json").questions,
  writing: readJson("data/practice/writing-sentences.json").sentences,
  reading: readJson("data/practice/reading-sentences.json").sentences,
});
// officer-a: every clip, as before. officer-b and officer-c: the officer's clips, in their own folder.
const allClips = officerClipList(baseClips, VOICE);
const clips = onlyGroups ? allClips.filter((clip) => onlyGroups.has(clip.group)) : allClips;

// ---------------------------------------------------------------------------
// Manifest and plan
// ---------------------------------------------------------------------------

let manifest = emptyManifest();
if (fs.existsSync(MANIFEST_FILE)) manifest = parseManifest(JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8")));
// The section of the chosen voice. The other sections are written back unchanged.
let section = voiceSection(manifest, VOICE);
const sameSettings = voiceMatchesSettings(manifest, VOICE);
if (!sameSettings && onlyGroups && Object.keys(section.clips).length > 0) {
  console.error("The voice settings changed since the clips were made. Run without --only so every clip is regenerated.");
  process.exit(1);
}

function isCurrent(clip) {
  const entry = section.clips[clip.id];
  return (
    sameSettings &&
    entry !== undefined &&
    entry.hash === hashText(clip.text) &&
    entry.file === clip.file &&
    fs.existsSync(path.join(AUDIO_DIR, clip.file))
  );
}

const toGenerate = clips.filter((clip) => !isCurrent(clip));
const upToDate = clips.length - toGenerate.length;
const chars = (list) => list.reduce((sum, clip) => sum + clip.text.length, 0);

const knownIds = new Set(allClips.map((c) => c.id));
const orphans = Object.keys(section.clips).filter((id) => !knownIds.has(id));

/** Estimated seconds of speech for a clip: officer-a's MP3 of the same text when there is one. */
function secondsOf(clip) {
  const original = manifest.clips[clip.id];
  if (original && original.hash === hashText(clip.text) && typeof original.bytes === "number") return original.bytes / MP3_BYTES_PER_SECOND;
  return clip.text.length / CHARS_PER_SECOND;
}

function estimate(list) {
  const textTokens = list.reduce((sum, c) => sum + Math.ceil((c.text.length + SETTING.instruction.length) / CHARS_PER_TEXT_TOKEN), 0);
  const seconds = list.reduce((sum, c) => sum + secondsOf(c), 0);
  const audioTokens = Math.round(seconds * AUDIO_TOKENS_PER_SECOND);
  const cost = (textTokens * PRICING.textInputPerMillion + audioTokens * PRICING.audioOutputPerMillion) / 1e6;
  return { textTokens, seconds, audioTokens, cost };
}

function reportCost() {
  const e = estimate(toGenerate);
  console.log("");
  console.log(`Estimated cost: US$${e.cost.toFixed(2)} for ${toGenerate.length} clips`);
  console.log(`  text input   ~${e.textTokens} tokens (text and instruction) x US$${PRICING.textInputPerMillion.toFixed(2)} per 1M`);
  console.log(`  audio output ~${e.audioTokens} tokens (~${(e.seconds / 60).toFixed(1)} minutes of speech) x US$${PRICING.audioOutputPerMillion.toFixed(2)} per 1M`);
  console.log(`  Prices for ${PRICING.model} from ${PRICING.pricingUrl} and ${PRICING.modelUrl}, read ${PRICING.read}.`);
  console.log(`  Assumes ${AUDIO_TOKENS_PER_SECOND} audio tokens per second (not stated for this model) and the speech length of officer-a's clips.`);
}

function report() {
  console.log("Language Lab: spoken prompt generator");
  console.log(`Voice ${VOICE}: model ${SETTING.model}, voice ${SETTING.voice}`);
  console.log(`Output ${path.relative(ROOT, AUDIO_DIR)}/`);
  if (!sameSettings) console.log("Voice settings differ from the manifest: every clip counts as out of date.");
  console.log("");
  const rows = [];
  for (const group of CLIP_GROUPS) {
    const inGroup = clips.filter((c) => c.group === group);
    if (inGroup.length === 0) continue;
    const need = toGenerate.filter((c) => c.group === group);
    rows.push({ group, clips: inGroup.length, toGenerate: need.length, characters: chars(need) });
  }
  console.log("group           clips   to generate   characters");
  for (const r of rows) {
    console.log(`${r.group.padEnd(15)} ${String(r.clips).padStart(5)}   ${String(r.toGenerate).padStart(11)}   ${String(r.characters).padStart(10)}`);
  }
  console.log("");
  console.log(`Clips selected: ${clips.length}. Up to date: ${upToDate}. To generate: ${toGenerate.length}.`);
  console.log(`Characters to generate: ${chars(toGenerate)} (all selected clips: ${chars(clips)}).`);
  if (orphans.length > 0) {
    console.log(`${orphans.length} manifest entr${orphans.length === 1 ? "y has" : "ies have"} no source text any more: ${orphans.join(", ")}.`);
    console.log(prune ? "They will be deleted (--prune)." : "Run with --prune to delete them. A stale manifest entry fails the tests.");
  }
}

// ---------------------------------------------------------------------------
// Dry run
// ---------------------------------------------------------------------------

if (dryRun) {
  report();
  reportCost();
  if (toGenerate.length > 0) {
    console.log("\nWould generate:");
    for (const clip of toGenerate) console.log(`  ${clip.file}  (${clip.text.length} characters)`);
  }
  console.log("\nDry run: nothing was written and no API call was made.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Key (read only when there is something to generate)
// ---------------------------------------------------------------------------

function loadKey() {
  if (!fs.existsSync(KEY_FILE)) {
    console.error(`\nThe key file is missing: ${path.relative(ROOT, KEY_FILE)}\nCreate it with one line: OPENAI_API_KEY=sk-...`);
    process.exit(1);
  }
  for (const line of fs.readFileSync(KEY_FILE, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() === "OPENAI_API_KEY") {
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (value.startsWith("sk-")) return value;
    }
  }
  console.error(`\nOPENAI_API_KEY is missing or does not start with "sk-" in ${path.relative(ROOT, KEY_FILE)}.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// TTS
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateSpeech(key, text) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SETTING.model,
        voice: SETTING.voice,
        input: text,
        instructions: SETTING.instruction,
        response_format: "mp3",
      }),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= MAX_ATTEMPTS) {
      // The response body describes the problem; the request (and the key) is never printed.
      throw new Error(`OpenAI API error ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    await sleep(1000 * 2 ** attempt);
  }
}

function writeManifest() {
  const ordered = Object.fromEntries(Object.entries(section.clips).sort(([a], [b]) => a.localeCompare(b)));
  manifest = withVoiceSection(manifest, VOICE, { tts: section.tts, clips: ordered });
  const { voices, ...rest } = manifest;
  const out = voices === undefined ? rest : { ...rest, voices: Object.fromEntries(Object.entries(voices).sort(([a], [b]) => a.localeCompare(b))) };
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(out, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  report();

  if (prune) {
    for (const id of orphans) {
      const file = path.join(AUDIO_DIR, section.clips[id].file);
      if (fs.existsSync(file)) fs.rmSync(file);
      delete section.clips[id];
    }
  }

  if (!sameSettings) {
    // New voice settings: this voice's old clips were made with other settings, so start its section again.
    section = { tts: { model: SETTING.model, voice: SETTING.voice, instruction: SETTING.instruction }, clips: {} };
  }

  if (toGenerate.length === 0) {
    writeManifest();
    console.log("\nNothing to generate.");
    return;
  }

  const key = loadKey();
  let generated = 0;
  let failed = 0;
  console.log("");
  for (const clip of toGenerate) {
    process.stdout.write(`  GEN   ${clip.file} ... `);
    try {
      const data = await generateSpeech(key, clip.text);
      const target = path.join(AUDIO_DIR, clip.file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target + ".tmp", data);
      fs.renameSync(target + ".tmp", target);
      section.clips[clip.id] = {
        file: clip.file,
        hash: hashText(clip.text),
        group: clip.group,
        bytes: data.length,
        ...(VOICE === "officer-a" ? {} : { voice: VOICE }),
      };
      writeManifest(); // after every clip, so an interrupted run loses nothing
      console.log(`done (${Math.round(data.length / 1024)} kB)`);
      generated++;
      await sleep(PAUSE_MS);
    } catch (error) {
      console.log(`FAILED ${error.message}`);
      failed++;
    }
  }
  writeManifest();
  console.log(`\nDone. Generated: ${generated}. Failed: ${failed}. Already up to date: ${upToDate}.`);
  if (failed > 0) {
    console.error(`${failed} clip(s) failed. Run the script again to retry them.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`\nFatal: ${error.message}`);
  process.exit(1);
});
