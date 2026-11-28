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

/** The three officer voices (decisions log T). A practice uses one of them from start to end. */
export type OfficerVoiceId = "officer-a" | "officer-b" | "officer-c";
export const OFFICER_VOICES: readonly OfficerVoiceId[] = ["officer-a", "officer-b", "officer-c"];
/** The officer voices that have their own folder and manifest section (officer-a is the original set). */
export type ExtraOfficerVoiceId = Exclude<OfficerVoiceId, "officer-a">;
export const EXTRA_OFFICER_VOICES: readonly ExtraOfficerVoiceId[] = ["officer-b", "officer-c"];

export interface TtsSetting {
  id: OfficerVoiceId;
  model: string;
  voice: string;
  instruction: string;
}

const OFFICER_INSTRUCTION = "Speak clear American English slowly and naturally, like a patient interviewer.";

/**
 * The voice settings of each officer voice. A change to one makes every clip of that voice out of
 * date. officer-a is the original voice: its files stay in public/audio/<group>/ and its entries
 * stay at the top of the manifest. officer-b and officer-c use the same model and instruction at
 * the default speed, with other built-in voices, in public/audio/<voice>/<group>/.
 */
export const TTS_SETTINGS: readonly TtsSetting[] = [
  { id: "officer-a", model: "gpt-4o-mini-tts", voice: "coral", instruction: OFFICER_INSTRUCTION },
  { id: "officer-b", model: "gpt-4o-mini-tts", voice: "cedar", instruction: OFFICER_INSTRUCTION },
  { id: "officer-c", model: "gpt-4o-mini-tts", voice: "marin", instruction: OFFICER_INSTRUCTION },
];

/** The settings of one officer voice. */
export function ttsSettingsFor(voice: OfficerVoiceId): TtsSetting {
  const found = TTS_SETTINGS.find((s) => s.id === voice);
  if (found === undefined) throw new Error(`unknown officer voice ${voice}`);
  return found;
}

export function isOfficerVoice(value: unknown): value is OfficerVoiceId {
  return typeof value === "string" && (OFFICER_VOICES as readonly string[]).includes(value);
}

/**
 * The officer of one practice, from the practice's seed (the same seed always gives the same
 * officer, so tests are deterministic). The seed is mixed first, so neighbouring seeds do not
 * simply take turns.
 */
export function pickOfficerVoice(seed: number): OfficerVoiceId {
  let h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return OFFICER_VOICES[(h >>> 0) % OFFICER_VOICES.length]!;
}

export type ClipGroup = "civics-2008" | "civics-2025" | "n400" | "n400-samples" | "writing" | "reading";

export const CLIP_GROUPS: readonly ClipGroup[] = ["civics-2008", "civics-2025", "n400", "n400-samples", "writing", "reading"];

/** What the officer says: civics questions, N-400 questions, reading and writing sentences. Not the sample answers. */
export const OFFICER_CLIP_GROUPS: readonly ClipGroup[] = ["civics-2008", "civics-2025", "n400", "writing", "reading"];

export const isOfficerGroup = (group: ClipGroup): boolean => OFFICER_CLIP_GROUPS.includes(group);

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
  /** The officer voice of the clip. Absent on the original (officer-a) entries. */
  voice?: OfficerVoiceId;
}

export interface ManifestTts {
  model: string;
  voice: string;
  instruction: string;
}

/** The clips of one extra officer voice. */
export interface VoiceManifest {
  tts: ManifestTts;
  clips: Record<string, ManifestEntry>;
}

/**
 * The manifest. `tts` and `clips` are the original officer-a voice, unchanged, so an older reader
 * still works. `voices` is optional and holds officer-b and officer-c, keyed by the same clip ids.
 */
export interface AudioManifest {
  version: 1;
  tts: ManifestTts;
  clips: Record<string, ManifestEntry>;
  voices?: Partial<Record<ExtraOfficerVoiceId, VoiceManifest>>;
}

const ttsOf = (setting: TtsSetting): ManifestTts => ({ model: setting.model, voice: setting.voice, instruction: setting.instruction });

/** The manifest of a build with no audio yet. Everything then falls back to the device voice. */
export function emptyManifest(): AudioManifest {
  return { version: 1, tts: ttsOf(ttsSettingsFor("officer-a")), clips: {} };
}

/** The section of one officer voice: the top of the manifest for officer-a, `voices.<id>` otherwise (empty when missing). */
export function voiceSection(manifest: AudioManifest, voice: OfficerVoiceId): VoiceManifest {
  if (voice === "officer-a") return { tts: manifest.tts, clips: manifest.clips };
  return manifest.voices?.[voice] ?? { tts: ttsOf(ttsSettingsFor(voice)), clips: {} };
}

/** A copy of the manifest with one voice's section replaced. The other sections are kept as they are. */
export function withVoiceSection(manifest: AudioManifest, voice: OfficerVoiceId, section: VoiceManifest): AudioManifest {
  if (voice === "officer-a") return { ...manifest, tts: section.tts, clips: section.clips };
  return { ...manifest, voices: { ...manifest.voices, [voice]: section } };
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
/** Clip id of a reading sentence (sample for listen-and-compare); the sentence id is already stable ("read-001"). */
export const readingClipId = (sentenceId: string): string => sentenceId;

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
  /** Reading sentences (the sample of listen-and-compare). */
  reading?: ReadonlyArray<{ id: string; text: string }>;
}

/**
 * Every clip the app can play: civics question text for both answer keys, the N-400 questions
 * and each profile's sample answer, the writing sentences, and the reading sentences. A reading
 * clip is the sample of listen-and-compare: the screen never plays it before the first attempt.
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
  for (const sentence of sources.reading ?? []) {
    clips.push({ id: readingClipId(sentence.id), group: "reading", file: `reading/${sentence.id}.mp3`, text: sentence.text });
  }
  return clips;
}

/**
 * The clips of one officer voice. officer-a: the whole list, as before (it also speaks the sample
 * answers). officer-b and officer-c: the officer's clips only, in public/audio/<voice>/ with the
 * same relative paths.
 */
export function officerClipList(clips: readonly Clip[], voice: OfficerVoiceId): Clip[] {
  if (voice === "officer-a") return [...clips];
  return clips.filter((clip) => isOfficerGroup(clip.group)).map((clip) => ({ ...clip, file: `${voice}/${clip.file}` }));
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
  const result: AudioManifest = {
    version: 1,
    tts: { model: tts["model"], voice: tts["voice"], instruction: tts["instruction"] },
    clips: parseEntries(clips, "officer-a"),
  };
  const voices = raw["voices"];
  if (voices !== undefined) {
    if (!isRecord(voices)) throw new Error("audio manifest: voices must be an object.");
    const parsedVoices: Partial<Record<ExtraOfficerVoiceId, VoiceManifest>> = {};
    for (const [voice, section] of Object.entries(voices)) {
      if (!(EXTRA_OFFICER_VOICES as readonly string[]).includes(voice)) throw new Error(`audio manifest: unknown voice ${voice}.`);
      if (!isRecord(section) || !isRecord(section["tts"]) || !isRecord(section["clips"])) {
        throw new Error(`audio manifest: voice ${voice} must have tts and clips.`);
      }
      const vt = section["tts"];
      if (typeof vt["model"] !== "string" || typeof vt["voice"] !== "string" || typeof vt["instruction"] !== "string") {
        throw new Error(`audio manifest: voice ${voice}: tts must name model, voice and instruction.`);
      }
      parsedVoices[voice as ExtraOfficerVoiceId] = {
        tts: { model: vt["model"], voice: vt["voice"], instruction: vt["instruction"] },
        clips: parseEntries(section["clips"], voice as ExtraOfficerVoiceId),
      };
    }
    result.voices = parsedVoices;
  }
  return result;
}

function parseEntries(clips: Record<string, unknown>, voice: OfficerVoiceId): Record<string, ManifestEntry> {
  const where = voice === "officer-a" ? "clip" : `voice ${voice}: clip`;
  const parsed: Record<string, ManifestEntry> = {};
  for (const [id, entry] of Object.entries(clips)) {
    if (!isRecord(entry)) throw new Error(`audio manifest: ${where} ${id} must be an object.`);
    const { file, hash, group, bytes } = entry;
    if (typeof file !== "string" || !/^[a-z0-9][a-z0-9/_.-]*\.mp3$/i.test(file) || file.includes("..")) {
      throw new Error(`audio manifest: ${where} ${id} has a bad file name.`);
    }
    if (typeof hash !== "string" || !/^[0-9a-f]{14}$/.test(hash)) throw new Error(`audio manifest: ${where} ${id} has a bad hash.`);
    if (typeof group !== "string" || !(CLIP_GROUPS as readonly string[]).includes(group)) {
      throw new Error(`audio manifest: ${where} ${id} has an unknown group.`);
    }
    if (entry["voice"] !== undefined && entry["voice"] !== voice) throw new Error(`audio manifest: ${where} ${id} names another voice.`);
    if (voice !== "officer-a") {
      // The extra voices speak only the officer's lines, from their own folder.
      if (!isOfficerGroup(group as ClipGroup)) throw new Error(`audio manifest: ${where} ${id} is not an officer clip.`);
      if (!file.startsWith(`${voice}/`)) throw new Error(`audio manifest: ${where} ${id} is outside ${voice}/.`);
    }
    parsed[id] = {
      file,
      hash,
      group: group as ClipGroup,
      ...(typeof bytes === "number" ? { bytes } : {}),
      ...(voice === "officer-a" ? {} : { voice }),
    };
  }
  return parsed;
}

export interface ManifestProblem {
  id: string;
  problem: "unknown-clip" | "text-changed" | "file-changed" | "settings-changed";
  /** Set for the officer-b and officer-c sections. */
  voice?: ExtraOfficerVoiceId;
}

/**
 * Entries that must not ship: the clip no longer exists in the source data, its text changed
 * since it was generated, or its file name changed. An empty list means every entry matches.
 */
export function findStaleClips(manifest: AudioManifest, current: readonly Clip[]): ManifestProblem[] {
  const problems = staleIn(manifest.clips, current);
  for (const voice of EXTRA_OFFICER_VOICES) {
    const section = manifest.voices?.[voice];
    if (section === undefined) continue;
    const settingsOk = voiceMatchesSettings(manifest, voice);
    for (const p of staleIn(section.clips, officerClipList(current, voice))) problems.push({ ...p, voice });
    if (!settingsOk) for (const id of Object.keys(section.clips)) problems.push({ id, problem: "settings-changed", voice });
  }
  return problems;
}

function staleIn(entries: Record<string, ManifestEntry>, current: readonly Clip[]): ManifestProblem[] {
  const byId = new Map(current.map((clip) => [clip.id, clip]));
  const problems: ManifestProblem[] = [];
  for (const [id, entry] of Object.entries(entries)) {
    const clip = byId.get(id);
    if (clip === undefined) problems.push({ id, problem: "unknown-clip" });
    else if (hashText(clip.text) !== entry.hash) problems.push({ id, problem: "text-changed" });
    else if (clip.file !== entry.file) problems.push({ id, problem: "file-changed" });
  }
  return problems;
}

/** Every MP3 file the manifest lists, in every voice section. */
export function manifestFiles(manifest: AudioManifest): string[] {
  const files = Object.values(manifest.clips).map((e) => e.file);
  for (const voice of EXTRA_OFFICER_VOICES) for (const e of Object.values(manifest.voices?.[voice]?.clips ?? {})) files.push(e.file);
  return files;
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

/**
 * The file the officer of this practice says a prompt with, or null. Order: the chosen voice's
 * clip, then officer-a's clip (null then means the device voice). The extra voices are used only
 * for officer clips: a sample answer always keeps officer-a's clip.
 */
export function officerClipFileFor(manifest: AudioManifest, voice: OfficerVoiceId, clipId: string | undefined, text: string): string | null {
  return officerClipFiles(manifest, voice, clipId, text)[0] ?? null;
}

/** Every file that can say this prompt, best first (the chosen voice, then officer-a). */
export function officerClipFiles(manifest: AudioManifest, voice: OfficerVoiceId, clipId: string | undefined, text: string): string[] {
  const files: string[] = [];
  if (clipId !== undefined && voice !== "officer-a" && voiceMatchesSettings(manifest, voice)) {
    const entry = manifest.voices?.[voice]?.clips[clipId];
    const original = manifest.clips[clipId];
    const officerLine = entry !== undefined && isOfficerGroup(entry.group) && (original === undefined || isOfficerGroup(original.group));
    if (officerLine && entry.hash === hashText(text) && entry.file.startsWith(`${voice}/`)) files.push(entry.file);
  }
  const fallback = clipFileFor(manifest, clipId, text);
  if (fallback !== null) files.push(fallback);
  return files;
}

/** True when one voice's section was made with that voice's current settings. */
export function voiceMatchesSettings(manifest: AudioManifest, voice: OfficerVoiceId): boolean {
  const setting = ttsSettingsFor(voice);
  const tts = voiceSection(manifest, voice).tts;
  return tts.model === setting.model && tts.voice === setting.voice && tts.instruction === setting.instruction;
}

/** True when the original (officer-a) clips were made with the current officer-a settings. */
export function manifestMatchesSettings(manifest: AudioManifest): boolean {
  return voiceMatchesSettings(manifest, "officer-a");
}
