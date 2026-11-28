/**
 * Officer voices (decisions log T): three voices, one per practice, chosen from the seed; the
 * extra voices speak only the officer's lines; the manifest stays readable as before.
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import civics2008 from "../../../data/civics-answers/2008.json" with { type: "json" };
import civics2025 from "../../../data/civics-answers/2025.json" with { type: "json" };
import manifestRaw from "../../../public/audio/manifest.json" with { type: "json" };
import {
  buildClipList,
  emptyManifest,
  findStaleClips,
  hashText,
  isOfficerGroup,
  manifestFiles,
  officerClipFileFor,
  officerClipFiles,
  officerClipList,
  OFFICER_VOICES,
  parseManifest,
  pickOfficerVoice,
  TTS_SETTINGS,
  ttsSettingsFor,
  voiceMatchesSettings,
  withVoiceSection,
  type AudioManifest,
  type Clip,
  type ExtraOfficerVoiceId,
} from "../audio-clips";
import { loadPracticeContent } from "../practice-content";

const content = loadPracticeContent();
const clips = buildClipList({
  civics: {
    "2008": civics2008.entries as Array<{ id: string; questionText: string }>,
    "2025": civics2025.entries as Array<{ id: string; questionText: string }>,
  },
  n400: content.n400Questions,
  writing: content.writingSentences,
  reading: content.readingSentences,
});

const entriesOf = (list: readonly Clip[], voice?: ExtraOfficerVoiceId) =>
  Object.fromEntries(list.map((c) => [c.id, { file: c.file, hash: hashText(c.text), group: c.group, ...(voice ? { voice } : {}) }]));

/** A manifest with officer-a for every clip and officer-b for every officer clip. */
function threeVoiceManifest(): AudioManifest {
  const base: AudioManifest = { ...emptyManifest(), clips: entriesOf(clips) };
  const b = ttsSettingsFor("officer-b");
  return withVoiceSection(base, "officer-b", {
    tts: { model: b.model, voice: b.voice, instruction: b.instruction },
    clips: entriesOf(officerClipList(clips, "officer-b"), "officer-b"),
  });
}

const civicsClip = clips.find((c) => c.group === "civics-2008")!;
const sampleClip = clips.find((c) => c.group === "n400-samples")!;

describe("the three officer voices", () => {
  it("officer-a is the original voice, unchanged", () => {
    expect(ttsSettingsFor("officer-a")).toEqual({
      id: "officer-a",
      model: "gpt-4o-mini-tts",
      voice: "coral",
      instruction: "Speak clear American English slowly and naturally, like a patient interviewer.",
    });
  });

  it("officer-b and officer-c use other built-in voices, the same model and the same instruction", () => {
    expect(TTS_SETTINGS.map((s) => s.id)).toEqual(OFFICER_VOICES);
    expect(new Set(TTS_SETTINGS.map((s) => s.voice)).size).toBe(3);
    for (const s of TTS_SETTINGS) {
      expect(s.model).toBe(ttsSettingsFor("officer-a").model);
      expect(s.instruction).toBe(ttsSettingsFor("officer-a").instruction);
    }
  });
});

describe("pickOfficerVoice: the officer changes only through the seed", () => {
  it("property: the same seed always gives the same officer, and always a known one", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2_147_483_646 }), (seed) => {
        const voice = pickOfficerVoice(seed);
        return OFFICER_VOICES.includes(voice) && pickOfficerVoice(seed) === voice;
      }),
      { numRuns: 500 }
    );
  });

  it("each officer comes up for some seeds, in roughly equal shares", () => {
    const counts = new Map(OFFICER_VOICES.map((v) => [v, 0]));
    for (let seed = 0; seed < 3000; seed++) counts.set(pickOfficerVoice(seed), counts.get(pickOfficerVoice(seed))! + 1);
    for (const v of OFFICER_VOICES) expect(counts.get(v)!, v).toBeGreaterThan(800);
  });
});

describe("the officer's clips", () => {
  it("officer-a keeps every clip and its paths; officer-b and officer-c have the officer clips only, under their folder", () => {
    expect(officerClipList(clips, "officer-a")).toEqual(clips);
    for (const voice of ["officer-b", "officer-c"] as const) {
      const list = officerClipList(clips, voice);
      expect(list.length).toBe(clips.filter((c) => c.group !== "n400-samples").length);
      expect(list.some((c) => c.group === "n400-samples")).toBe(false);
      for (const clip of list) {
        const original = clips.find((c) => c.id === clip.id)!;
        expect(clip.file).toBe(`${voice}/${original.file}`);
        expect(clip.text).toBe(original.text);
      }
    }
  });

  it("the officer groups are civics (both keys), N-400 questions, reading and writing", () => {
    expect(["civics-2008", "civics-2025", "n400", "writing", "reading"].every((g) => isOfficerGroup(g as never))).toBe(true);
    expect(isOfficerGroup("n400-samples")).toBe(false);
  });
});

describe("fallback order: the chosen voice, then officer-a, then the device voice", () => {
  const m = threeVoiceManifest();

  it("uses the chosen voice's clip first, then officer-a's", () => {
    expect(officerClipFiles(m, "officer-b", civicsClip.id, civicsClip.text)).toEqual([`officer-b/${civicsClip.file}`, civicsClip.file]);
    expect(officerClipFileFor(m, "officer-a", civicsClip.id, civicsClip.text)).toBe(civicsClip.file);
  });

  it("falls back to officer-a when the chosen voice has no clip for the text", () => {
    expect(officerClipFiles(m, "officer-c", civicsClip.id, civicsClip.text)).toEqual([civicsClip.file]);
    const noB = withVoiceSection(m, "officer-b", { ...m.voices!["officer-b"]!, clips: {} });
    expect(officerClipFileFor(noB, "officer-b", civicsClip.id, civicsClip.text)).toBe(civicsClip.file);
  });

  it("falls back to officer-a when the chosen voice's clip was made for other words or other settings", () => {
    const section = m.voices!["officer-b"]!;
    const changed = withVoiceSection(m, "officer-b", {
      ...section,
      clips: { ...section.clips, [civicsClip.id]: { ...section.clips[civicsClip.id]!, hash: hashText("Other words.") } },
    });
    expect(officerClipFiles(changed, "officer-b", civicsClip.id, civicsClip.text)).toEqual([civicsClip.file]);
    const otherVoice = withVoiceSection(m, "officer-b", { ...section, tts: { ...section.tts, voice: "alloy" } });
    expect(voiceMatchesSettings(otherVoice, "officer-b")).toBe(false);
    expect(officerClipFiles(otherVoice, "officer-b", civicsClip.id, civicsClip.text)).toEqual([civicsClip.file]);
  });

  it("returns nothing when no voice has the clip (the device voice then speaks)", () => {
    expect(officerClipFiles(emptyManifest(), "officer-b", civicsClip.id, civicsClip.text)).toEqual([]);
    expect(officerClipFiles(m, "officer-b", undefined, civicsClip.text)).toEqual([]);
  });

  it("a sample answer never uses officer-b or officer-c, even if a section lists it", () => {
    const section = m.voices!["officer-b"]!;
    // Built by hand: parseManifest refuses such an entry.
    const forged = withVoiceSection(m, "officer-b", {
      ...section,
      clips: { ...section.clips, [sampleClip.id]: { file: `officer-b/${sampleClip.file}`, hash: hashText(sampleClip.text), group: "n400", voice: "officer-b" } },
    });
    for (const voice of OFFICER_VOICES) {
      expect(officerClipFiles(forged, voice, sampleClip.id, sampleClip.text), voice).toEqual([sampleClip.file]);
    }
  });
});

describe("the manifest stays backward compatible", () => {
  it("the shipped manifest parses, and its officer-a entries are exactly the ones in the file", () => {
    const parsed = parseManifest(manifestRaw);
    const raw = manifestRaw as unknown as { tts: unknown; clips: Record<string, unknown> };
    expect(parsed.tts).toEqual(raw.tts);
    expect(parsed.clips).toEqual(raw.clips);
    for (const entry of Object.values(parsed.clips)) expect(entry.voice).toBeUndefined();
  });

  it("a manifest without voices (the old format) still parses, and every officer falls back to officer-a", () => {
    const old = JSON.parse(JSON.stringify({ ...emptyManifest(), clips: entriesOf(clips.slice(0, 3)) }));
    const parsed = parseManifest(old);
    expect(parsed.voices).toBeUndefined();
    for (const voice of OFFICER_VOICES) expect(officerClipFileFor(parsed, voice, clips[0]!.id, clips[0]!.text)).toBe(clips[0]!.file);
  });

  it("an old reader that ignores 'voices' sees the same officer-a manifest", () => {
    const m = JSON.parse(JSON.stringify(threeVoiceManifest())) as Record<string, unknown>;
    const { voices: _ignored, ...older } = m;
    expect(parseManifest(older).clips).toEqual(parseManifest(m).clips);
  });

  it("a three-voice manifest parses, keeps the voice per clip, and is not stale", () => {
    const m = JSON.parse(JSON.stringify(threeVoiceManifest()));
    const parsed = parseManifest(m);
    for (const entry of Object.values(parsed.voices!["officer-b"]!.clips)) expect(entry.voice).toBe("officer-b");
    expect(findStaleClips(parsed, clips)).toEqual([]);
    expect(manifestFiles(parsed).filter((f) => f.startsWith("officer-b/")).length).toBe(officerClipList(clips, "officer-b").length);
  });

  it("rejects an extra-voice entry that is a sample answer, sits outside its folder, or names another voice", () => {
    const good = JSON.parse(JSON.stringify(threeVoiceManifest()));
    const withEntry = (entry: object) => {
      const copy = JSON.parse(JSON.stringify(good));
      copy.voices["officer-b"].clips = { x: { file: "officer-b/writing/x.mp3", hash: "0".repeat(14), group: "writing", voice: "officer-b", ...entry } };
      return copy;
    };
    expect(() => parseManifest(withEntry({}))).not.toThrow();
    expect(() => parseManifest(withEntry({ group: "n400-samples", file: "officer-b/n400/x.mp3" }))).toThrow();
    expect(() => parseManifest(withEntry({ file: "writing/x.mp3" }))).toThrow();
    expect(() => parseManifest(withEntry({ file: "officer-c/writing/x.mp3" }))).toThrow();
    expect(() => parseManifest(withEntry({ voice: "officer-c" }))).toThrow();
    expect(() => parseManifest({ ...good, voices: { "officer-z": good.voices["officer-b"] } })).toThrow();
    expect(() => parseManifest({ ...good, voices: { "officer-a": good.voices["officer-b"] } })).toThrow();
  });

  it("finds stale extra-voice entries and names the voice", () => {
    const m = threeVoiceManifest();
    const changed = clips.map((c) => (c.id === civicsClip.id ? { ...c, text: c.text + " Please." } : c));
    const stale = findStaleClips(m, changed);
    expect(stale).toContainEqual({ id: civicsClip.id, problem: "text-changed" });
    expect(stale).toContainEqual({ id: civicsClip.id, problem: "text-changed", voice: "officer-b" });
    const section = m.voices!["officer-b"]!;
    const otherSettings = withVoiceSection(m, "officer-b", { ...section, tts: { ...section.tts, voice: "alloy" } });
    expect(findStaleClips(otherSettings, clips).every((p) => p.problem === "settings-changed" && p.voice === "officer-b")).toBe(true);
  });
});
