/**
 * The pre-generated audio: the clip list, the manifest in public/audio/, and the check that
 * stops stale audio from shipping. These tests pass when public/audio/ holds no clips yet
 * (every prompt then uses the device voice).
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import civics2008 from "../../../data/civics-answers/2008.json" with { type: "json" };
import civics2025 from "../../../data/civics-answers/2025.json" with { type: "json" };
import manifestRaw from "../../../public/audio/manifest.json" with { type: "json" };
import {
  buildClipList,
  civicsClipId,
  clipFileFor,
  emptyManifest,
  findStaleClips,
  hashText,
  EXTRA_OFFICER_VOICES,
  manifestFiles,
  manifestMatchesSettings,
  voiceMatchesSettings,
  parseManifest,
  sampleAnswerClipId,
  writingClipId,
  type AudioManifest,
  type Clip,
} from "../audio-clips";
import { loadPracticeContent } from "../practice-content";

const content = loadPracticeContent();
const sources = {
  civics: {
    "2008": civics2008.entries as Array<{ id: string; questionText: string }>,
    "2025": civics2025.entries as Array<{ id: string; questionText: string }>,
  },
  n400: content.n400Questions,
  writing: content.writingSentences,
  reading: content.readingSentences,
};
const clips = buildClipList(sources);
const manifest = parseManifest(manifestRaw);

/** A manifest as the generator would write it for these clips. */
function fullManifest(list: readonly Clip[]): AudioManifest {
  return {
    ...emptyManifest(),
    clips: Object.fromEntries(list.map((c) => [c.id, { file: c.file, hash: hashText(c.text), group: c.group }])),
  };
}

// Files that exist in public/audio (keys only; nothing is loaded).
const files = Object.keys(import.meta.glob("../../../public/audio/**/*.mp3", { query: "?url", import: "default" })).map(
  (key) => key.replace("../../../public/audio/", "")
);

describe("the clip list", () => {
  it("covers every civics question in both keys, every N-400 question and sample answer, every writing sentence and every reading sentence", () => {
    const expected =
      sources.civics["2008"].length +
      sources.civics["2025"].length +
      content.n400Questions.length +
      content.n400Questions.length * content.profiles.length +
      content.writingSentences.length +
      content.readingSentences.length;
    expect(clips).toHaveLength(expected);
    expect(clips.filter((c) => c.group === "civics-2008")).toHaveLength(sources.civics["2008"].length);
    expect(clips.filter((c) => c.group === "civics-2025")).toHaveLength(sources.civics["2025"].length);
    expect(clips.filter((c) => c.group === "n400")).toHaveLength(content.n400Questions.length);
    expect(clips.filter((c) => c.group === "n400-samples")).toHaveLength(content.n400Questions.length * content.profiles.length);
    expect(clips.filter((c) => c.group === "writing")).toHaveLength(content.writingSentences.length);
  });

  it("has one reading clip per reading sentence, in the reading group only", () => {
    const readingIds = new Set(content.readingSentences.map((sentence) => sentence.id));
    expect(clips.filter((c) => c.group === "reading")).toHaveLength(content.readingSentences.length);
    for (const clip of clips) {
      expect(readingIds.has(clip.id), clip.id).toBe(clip.group === "reading");
      expect(clip.file.startsWith("reading/"), clip.id).toBe(clip.group === "reading");
    }
  });

  it("has unique ids and unique, safe file names derived from the ids", () => {
    expect(new Set(clips.map((c) => c.id)).size).toBe(clips.length);
    expect(new Set(clips.map((c) => c.file)).size).toBe(clips.length);
    for (const clip of clips) {
      expect(clip.file, clip.id).toMatch(/^[a-z0-9][a-z0-9/_.-]*\.mp3$/);
      expect(clip.text.trim().length, clip.id).toBeGreaterThan(0);
    }
  });

  it("uses ids the screens use", () => {
    const ids = new Set(clips.map((c) => c.id));
    for (const entry of sources.civics["2008"].concat(sources.civics["2025"])) expect(ids.has(civicsClipId(entry.id))).toBe(true);
    for (const s of content.writingSentences) expect(ids.has(writingClipId(s.id))).toBe(true);
    for (const q of content.n400Questions) {
      expect(ids.has(q.id)).toBe(true);
      for (const p of content.profiles) expect(ids.has(sampleAnswerClipId(q.id, p.id))).toBe(true);
    }
  });

  it("holds only fictional, practice text", () => {
    expect(clips.map((c) => c.text).join("\n")).not.toMatch(/\bA[- ]?\d{8,9}\b/);
  });
});

describe("hashText", () => {
  it("is 14 hex digits and stable", () => {
    expect(hashText("What is the supreme law of the land?")).toMatch(/^[0-9a-f]{14}$/);
    expect(hashText("abc")).toBe(hashText("abc"));
  });

  it("property: the same text gives the same hash; any change gives a different one", () => {
    fc.assert(
      fc.property(fc.string(), fc.string({ minLength: 1 }), (a, extra) => {
        return hashText(a) === hashText(a) && hashText(a) !== hashText(a + extra);
      }),
      { numRuns: 500 }
    );
  });
});

describe("the manifest that ships (public/audio/manifest.json)", () => {
  it("is valid", () => {
    expect(manifest.version).toBe(1);
  });

  it("holds no stale entry: every clip matches the current text, id and file name", () => {
    const stale = findStaleClips(manifest, clips);
    expect(stale, `Regenerate the audio (node --no-warnings tools/audio/generate-audio.mjs --prune). Stale: ${JSON.stringify(stale)}`).toEqual([]);
  });

  it("was made with the current voice settings (when it has clips)", () => {
    if (Object.keys(manifest.clips).length > 0) expect(manifestMatchesSettings(manifest)).toBe(true);
    for (const voice of EXTRA_OFFICER_VOICES) {
      if (Object.keys(manifest.voices?.[voice]?.clips ?? {}).length > 0) expect(voiceMatchesSettings(manifest, voice), voice).toBe(true);
    }
  });

  it("every entry has its MP3 file in public/audio, in every officer voice", () => {
    for (const file of manifestFiles(manifest)) expect(files, file).toContain(file);
  });

  it("every MP3 file in public/audio is listed in the manifest", () => {
    const listed = new Set(manifestFiles(manifest));
    for (const file of files) expect(listed.has(file), file).toBe(true);
  });

  it("works while empty: every prompt then has no clip and uses the device voice", () => {
    for (const clip of clips) {
      const file = clipFileFor(manifest, clip.id, clip.text);
      expect(file === null || file === clip.file).toBe(true);
    }
  });
});

describe("findStaleClips", () => {
  it("passes for a manifest made from the current clips, and for an empty one", () => {
    expect(findStaleClips(fullManifest(clips), clips)).toEqual([]);
    expect(findStaleClips(emptyManifest(), clips)).toEqual([]);
  });

  it("catches a question or sentence whose text changed after its audio was made", () => {
    const m = fullManifest(clips);
    const changed = clips.map((c, i) => (i === 3 ? { ...c, text: c.text + " Please." } : c));
    expect(findStaleClips(m, changed)).toEqual([{ id: clips[3]!.id, problem: "text-changed" }]);
  });

  it("catches an entry whose source no longer exists", () => {
    const m = fullManifest(clips);
    expect(findStaleClips(m, clips.slice(1))).toEqual([{ id: clips[0]!.id, problem: "unknown-clip" }]);
  });

  it("catches a changed file name", () => {
    const m = fullManifest(clips);
    const moved = clips.map((c, i) => (i === 0 ? { ...c, file: "other/name.mp3" } : c));
    expect(findStaleClips(m, moved)).toEqual([{ id: clips[0]!.id, problem: "file-changed" }]);
  });

  it("property: any one-character edit to a clip's text is caught", () => {
    const m = fullManifest(clips);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: clips.length - 1 }), fc.string({ minLength: 1, maxLength: 3 }), (index, extra) => {
        const edited = clips.map((c, i) => (i === index ? { ...c, text: c.text + extra } : c));
        const stale = findStaleClips(m, edited);
        return stale.length === 1 && stale[0]!.id === clips[index]!.id;
      }),
      { numRuns: 200 }
    );
  });
});

describe("clipFileFor", () => {
  const m = fullManifest(clips);
  const sample = clips[0]!;

  it("returns the file only when the id is listed and the text matches", () => {
    expect(clipFileFor(m, sample.id, sample.text)).toBe(sample.file);
    expect(clipFileFor(m, sample.id, sample.text + "!")).toBeNull();
    expect(clipFileFor(m, "nope", sample.text)).toBeNull();
    expect(clipFileFor(m, undefined, sample.text)).toBeNull();
  });

  it("finds a clip for the exact text each screen speaks", () => {
    for (const clip of clips) expect(clipFileFor(m, clip.id, clip.text), clip.id).toBe(clip.file);
  });
});

describe("parseManifest", () => {
  const good = JSON.parse(JSON.stringify(fullManifest(clips.slice(0, 2)))) as Record<string, unknown>;

  it("accepts a good manifest and rejects bad ones", () => {
    expect(() => parseManifest(good)).not.toThrow();
    expect(() => parseManifest(null)).toThrow();
    expect(() => parseManifest({ ...good, version: 2 })).toThrow();
    expect(() => parseManifest({ ...good, tts: {} })).toThrow();
    const entry = (patch: object) => ({
      ...good,
      clips: { x: { file: "a/x.mp3", hash: "0".repeat(14), group: "writing", ...patch } },
    });
    expect(() => parseManifest(entry({}))).not.toThrow();
    expect(() => parseManifest(entry({ file: "../x.mp3" }))).toThrow();
    expect(() => parseManifest(entry({ file: "x.wav" }))).toThrow();
    expect(() => parseManifest(entry({ hash: "zz" }))).toThrow();
    expect(() => parseManifest(entry({ group: "other" }))).toThrow();
  });
});
