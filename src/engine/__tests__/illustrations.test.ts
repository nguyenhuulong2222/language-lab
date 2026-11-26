/**
 * AI illustrations for CONCEPT questions: the prompts follow the rules, every CONCEPT question has
 * exactly one prompt, an unreviewed illustration is never returned, and no illustration is ever
 * paired with a PERSON, EVENT, DOCUMENT or DYNAMIC question.
 */
import { describe, expect, it } from "vitest";
import ANSWERS_2008 from "../../../data/civics-answers/2008.json";
import ANSWERS_2025 from "../../../data/civics-answers/2025.json";
import PROMPTS from "../../../data/images/illustration-prompts.json";
import {
  checkIllustrationData,
  composePrompt,
  estimateCost,
  illustrationForQuestion,
  ILLUSTRATIONS,
  NO_AI_CLASSES,
  QUESTION_CLASSES,
  type IllustrationEntry,
  type IllustrationManifest,
  type IllustrationPromptFile,
  type QuestionClasses,
} from "../illustrations";
const prompts = PROMPTS as unknown as IllustrationPromptFile;
const questions = [...ANSWERS_2008.entries, ...ANSWERS_2025.entries].map((e) => ({ id: e.id, answerType: e.answerType }));
const fileModules = import.meta.glob("../../../public/images/illustrations/*.webp", { eager: true, query: "?url", import: "default" });
const files = new Set(Object.keys(fileModules).map((k) => k.split("/").pop() as string));
const entry = (over: Partial<IllustrationEntry> = {}): IllustrationEntry => ({
  id: "rule-of-law",
  file: "rule-of-law.webp",
  questions: ["2008-012", "2025-013"],
  model: "gpt-image-2.6-flare",
  prompt: composePrompt(prompts, prompts.prompts.find((p) => p.id === "rule-of-law")!),
  date: "2026-11-26",
  sha256: "b".repeat(64),
  alt: "A balanced scale above a row of people.",
  caption: "A scale above a row of people",
  source: "ai",
  reviewed: true,
  width: 1024,
  height: 1024,
  bytes: 80000,
  ...over,
});
describe("the illustration data", () => {
  it("is consistent: classes, prompts, manifest and files", () => {
    expect(checkIllustrationData({ prompts, manifest: ILLUSTRATIONS, classes: QUESTION_CLASSES, questions, files })).toEqual([]);
  });
  it("classifies every question of both keys, and every dynamic question as DYNAMIC", () => {
    for (const q of questions) {
      expect(QUESTION_CLASSES.classes[q.id], q.id).toBeDefined();
      if (q.answerType === "dynamic") expect(QUESTION_CLASSES.classes[q.id], q.id).toBe("DYNAMIC");
    }
    expect(Object.keys(QUESTION_CLASSES.classes)).toHaveLength(questions.length);
  });
  it("gives every CONCEPT question exactly one prompt, and no other question any", () => {
    const covered = prompts.prompts.flatMap((p) => p.questions);
    expect(new Set(covered).size).toBe(covered.length);
    const concept = Object.entries(QUESTION_CLASSES.classes).filter(([, c]) => c === "CONCEPT").map(([q]) => q).sort();
    expect([...covered].sort()).toEqual(concept);
  });
  it("puts the rules line in every prompt, and the rules forbid text, real people, seals and other flags", () => {
    for (const p of prompts.prompts) {
      const full = composePrompt(prompts, p);
      expect(full.endsWith(prompts.rules), p.id).toBe(true);
      expect(full).toContain("#0d2052");
      expect(full).toContain("#b22234");
    }
    expect(prompts.rules).toMatch(/no text, letters/i);
    expect(prompts.rules).toMatch(/no real or historical person/i);
    expect(prompts.rules).toMatch(/no recreation of a historical event or of a historical document/i);
    expect(prompts.rules).toMatch(/no seals, eagles, badges/i);
    expect(prompts.rules).toMatch(/no flag except, at most, one plain U\.S\. flag/i);
    expect(prompts.rules).toMatch(/from behind or as simple shapes/i);
  });
  it("records the model and a cost estimate with its source", () => {
    expect(prompts.model).toMatch(/^gpt-image-/);
    expect(prompts.estimate.basis).toMatch(/developers\.openai\.com/);
    const cost = estimateCost(prompts);
    expect(cost.count).toBe(prompts.prompts.length);
    expect(cost.totalUsd).toBeCloseTo(prompts.prompts.length * prompts.estimate.usdPerImage, 2);
  });
  it("every illustration in the manifest is from source ai and paired with CONCEPT questions only", () => {
    for (const e of ILLUSTRATIONS.images) {
      expect(e.source).toBe("ai");
      for (const q of e.questions) expect(QUESTION_CLASSES.classes[q], `${e.id} ${q}`).toBe("CONCEPT");
    }
  });
});
describe("illustrationForQuestion", () => {
  const manifest = (e: IllustrationEntry): IllustrationManifest => ({ images: [e] });
  it("returns a reviewed illustration of a CONCEPT question", () => {
    expect(illustrationForQuestion("2008-012", manifest(entry()))?.id).toBe("rule-of-law");
  });
  it("never returns an unreviewed illustration", () => {
    expect(illustrationForQuestion("2008-012", manifest(entry({ reviewed: false })))).toBeNull();
    const notBoolean = entry({ reviewed: "true" as unknown as boolean });
    expect(illustrationForQuestion("2008-012", manifest(notBoolean))).toBeNull();
  });
  it("never returns one for a PERSON, EVENT, DOCUMENT or DYNAMIC question, even if a manifest pairs it", () => {
    for (const cls of NO_AI_CLASSES) {
      const q = Object.entries(QUESTION_CLASSES.classes).find(([, c]) => c === cls)![0];
      expect(illustrationForQuestion(q, manifest(entry({ questions: [q] }))), `${cls} ${q}`).toBeNull();
    }
  });
  it("returns null for a question it does not cover", () => {
    expect(illustrationForQuestion("2025-124", manifest(entry()))).toBeNull();
  });
});
describe("checkIllustrationData refuses", () => {
  const run = (over: { manifest?: IllustrationManifest; prompts?: IllustrationPromptFile; classes?: QuestionClasses; files?: Set<string> }) =>
    checkIllustrationData({
      prompts: over.prompts ?? prompts,
      manifest: over.manifest ?? { images: [] },
      classes: over.classes ?? QUESTION_CLASSES,
      questions,
      files: over.files ?? new Set(),
    }).map((p) => p.problem);
  it("an illustration paired with a PERSON, EVENT, DOCUMENT or DYNAMIC question", () => {
    for (const cls of NO_AI_CLASSES) {
      const q = Object.entries(QUESTION_CLASSES.classes).find(([, c]) => c === cls)![0];
      const problems = run({ manifest: { images: [entry({ questions: [q] })] }, files: new Set(["rule-of-law.webp"]) });
      expect(problems.join("\n"), cls).toContain(`which is ${cls}, not CONCEPT`);
    }
  });
  it("a prompt for a non-CONCEPT question", () => {
    const bad = { ...prompts, prompts: [...prompts.prompts, { id: "x", questions: ["2008-062"], scene: "s", alt: "a", caption: "c" }] };
    expect(run({ prompts: bad }).join("\n")).toContain("question 2008-062 is PERSON, not CONCEPT");
  });
  it("a rules line that no longer forbids text or real people", () => {
    expect(run({ prompts: { ...prompts, rules: "Rules: be nice." } }).join("\n")).toContain("must forbid text");
  });
  it("a source other than ai, a missing file, and an oversized file", () => {
    const problems = run({ manifest: { images: [entry({ source: "loc" as unknown as "ai", bytes: 200_000 })] } }).join("\n");
    expect(problems).toContain('source is not "ai"');
    expect(problems).toContain("is not in public/images/illustrations/");
    expect(problems).toContain("over the 150 kB target");
  });
  it("a CONCEPT question with no prompt", () => {
    const fewer = { ...prompts, prompts: prompts.prompts.filter((p) => p.id !== "out-of-many-one") };
    expect(run({ prompts: fewer }).join("\n")).toContain("question 2025-124: is CONCEPT but has no prompt".split(": ")[1]);
  });
});
