/**
 * src/engine/audio-clips.ts
 *
 * The list of spoken prompts that are generated ahead of time as MP3 files (OpenAI TTS), the
 * stable ids and file names for them, and the manifest format. The app never calls a TTS
 * service: it only plays files listed in public/audio/manifest.json.
 *
 * This module is used by the generator script (tools/audio/generate-audio.mjs, run by a
 * person), by the player, and by the tests that stop stale audio from shipping. So it has no
 * imports and uses only syntax that Node can run directly.
 *
 * Pure module: no DOM, no network.
 */

/** The voice settings used for every clip. A change here makes every clip out of date. */
export const TTS_SETTINGS = {
  model: "gpt-4o-mini-tts",
  voice: "coral",
  instruction: "Speak clear American English slowly and naturally, like a patient interviewer.",
} as const;

export type ClipGroup = "civics-2008" | "civics-2025" | "n400" | "n400-samples" | "writing";

export const CLIP_GROUPS: readonly ClipGroup[] = ["civics-2008", "civics-2025", "n400", "n400-samples", "writing"];

export interface Clip {
  /** Stable id, derived from the ids of the source data. */
  id: string;
  group: ClipGroup;
  /** Path under public/audio/, for example "civics/2008-001.mp3". */
  file: string;
  /** The exact text that is spoken. */
  text: string;
}

export interface ManifestEntry {
  file: string;
  /** hashText of the spoken text when the clip was generated. */
  hash: string;
  group: ClipGroup;
  bytes?: number;
}

export interface AudioManifest {
  version: 1;
  tts: { model: string; voice: string; instruction: string };
  clips: Record<string, ManifestEntry>;
}

/** The manifest of a build with no audio yet. Everything then falls back to the device voice. */
export function emptyManifest(): AudioManifest {
  return { version: 1, tts: { ...TTS_SETTINGS }, clips: {} };
}

/**
 * A short fingerprint of a text (cyrb53, 53 bits, as 14 hex digits). It detects that a text
 * changed after its clip was made. It is not a security hash.
 */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const value = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return value.toString(16).padStart(14, "0");
}

// ---------------------------------------------------------------------------
// Ids and file names
// ---------------------------------------------------------------------------

const PROFILE_PREFIX = "fictional-profile-";

/** Clip id of a civics question, from the answer key id ("2008-001"). */
export const civicsClipId = (questionId: string): string => `civics-${questionId}`;

/** Clip id of an N-400 question; the question id is already stable ("n400-001"). */
export const n400QuestionClipId = (questionId: string): string => questionId;

/** Clip id of the sample answer of one fictional profile. */
export const sampleAnswerClipId = (questionId: string, profileId: string): string =>
  `${questionId}-sample-${profileId.startsWith(PROFILE_PREFIX) ? profileId.slice(PROFILE_PREFIX.length) : profileId}`;

/** Clip id of a writing (dictation) sentence; the sentence id is already stable ("write-001"). */
export const writingClipId = (sentenceId: string): string => sentenceId;

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

export interface ClipSources {
  civics: {
    "2008": ReadonlyArray<{ id: string; questionText: string }>;
    "2025": ReadonlyArray<{ id: string; questionText: string }>;
  };
  n400: ReadonlyArray<{ id: string; text: string; sampleAnswers: Readonly<Record<string, string>> }>;
  writing: ReadonlyArray<{ id: string; text: string }>;
}

/**
 * Every clip the app can play: civics question text for both answer keys, the N-400 questions
 * and each profile's sample answer, and the writing sentences. Reading sentences are not here:
 * they are not played before the attempt.
 */
export function buildClipList(sources: ClipSources): Clip[] {
  const clips: Clip[] = [];
  for (const version of ["2008", "2025"] as const) {
    for (const entry of sources.civics[version]) {
      clips.push({
        id: civicsClipId(entry.id),
        group: version === "2008" ? "civics-2008" : "civics-2025",
        file: `civics/${entry.id}.mp3`,
        text: entry.questionText,
      });
    }
  }
  for (const question of sources.n400) {
    clips.push({ id: n400QuestionClipId(question.id), group: "n400", file: `n400/${question.id}.mp3`, text: question.text });
  }
  for (const question of sources.n400) {
    for (const [profileId, answer] of Object.entries(question.sampleAnswers)) {
      const id = sampleAnswerClipId(question.id, profileId);
      clips.push({ id, group: "n400-samples", file: `n400/${id}.mp3`, text: answer });
    }
  }
  for (const sentence of sources.writing) {
    clips.push({ id: writingClipId(sentence.id), group: "writing", file: `writing/${sentence.id}.mp3`, text: sentence.text });
  }
  return clips;
}

// ---------------------------------------------------------------------------
// Manifest checks
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate the manifest file. Throws a descriptive error for a malformed one. */
export function parseManifest(raw: unknown): AudioManifest {
  if (!isRecord(raw) || raw["version"] !== 1) throw new Error("audio manifest: version must be 1.");
  const tts = raw["tts"];
  if (!isRecord(tts) || typeof tts["model"] !== "string" || typeof tts["voice"] !== "string" || typeof tts["instruction"] !== "string") {
    throw new Error("audio manifest: tts must name model, voice and instruction.");
  }
  const clips = raw["clips"];
  if (!isRecord(clips)) throw new Error("audio manifest: clips must be an object.");
  const parsed: Record<string, ManifestEntry> = {};
  for (const [id, entry] of Object.entries(clips)) {
    if (!isRecord(entry)) throw new Error(`audio manifest: clip ${id} must be an object.`);
    const { file, hash, group, bytes } = entry;
    if (typeof file !== "string" || !/^[a-z0-9][a-z0-9/_.-]*\.mp3$/i.test(file) || file.includes("..")) {
      throw new Error(`audio manifest: clip ${id} has a bad file name.`);
    }
    if (typeof hash !== "string" || !/^[0-9a-f]{14}$/.test(hash)) throw new Error(`audio manifest: clip ${id} has a bad hash.`);
    if (typeof group !== "string" || !(CLIP_GROUPS as readonly string[]).includes(group)) {
      throw new Error(`audio manifest: clip ${id} has an unknown group.`);
    }
    parsed[id] = { file, hash, group: group as ClipGroup, ...(typeof bytes === "number" ? { bytes } : {}) };
  }
  return {
    version: 1,
    tts: { model: tts["model"], voice: tts["voice"], instruction: tts["instruction"] },
    clips: parsed,
  };
}

export interface ManifestProblem {
  id: string;
  problem: "unknown-clip" | "text-changed" | "file-changed";
}

/**
 * Entries that must not ship: the clip no longer exists in the source data, its text changed
 * since it was generated, or its file name changed. An empty list means every entry matches.
 */
export function findStaleClips(manifest: AudioManifest, current: readonly Clip[]): ManifestProblem[] {
  const byId = new Map(current.map((clip) => [clip.id, clip]));
  const problems: ManifestProblem[] = [];
  for (const [id, entry] of Object.entries(manifest.clips)) {
    const clip = byId.get(id);
    if (clip === undefined) problems.push({ id, problem: "unknown-clip" });
    else if (hashText(clip.text) !== entry.hash) problems.push({ id, problem: "text-changed" });
    else if (clip.file !== entry.file) problems.push({ id, problem: "file-changed" });
  }
  return problems;
}

/**
 * The file to play for a prompt, or null. The clip is used only when the manifest lists it and
 * its hash matches the text that is about to be spoken, so a clip made for other words is
 * never played.
 */
export function clipFileFor(manifest: AudioManifest, clipId: string | undefined, text: string): string | null {
  if (clipId === undefined) return null;
  const entry = manifest.clips[clipId];
  if (entry === undefined || entry.hash !== hashText(text)) return null;
  return entry.file;
}

/** True when the manifest was made with the current voice settings. */
export function manifestMatchesSettings(manifest: AudioManifest): boolean {
  return (
    manifest.tts.model === TTS_SETTINGS.model &&
    manifest.tts.voice === TTS_SETTINGS.voice &&
    manifest.tts.instruction === TTS_SETTINGS.instruction
  );
}
