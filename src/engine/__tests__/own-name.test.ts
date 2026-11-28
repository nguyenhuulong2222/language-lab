/**
 * "Use my name" (decisions log S): name checks, spelling, the coach with the name inserted on the
 * device, and the guard that keeps the name out of anything sent to the AI coach.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { createScriptedN400Coach, type N400Answer } from "../n400-coach";
import { loadPracticeContent } from "../practice-content";
import {
  checkOwnName,
  createOwnNameCoach,
  isLocalOnlyQuestion,
  nameParts,
  normaliseOwnName,
  OWN_NAME_MAX,
  OWN_NAME_SCRIPT,
  protectNameForCoach,
  spellWord,
  spellingOfParts,
} from "../own-name";
const content = loadPracticeContent();
const base = content.profiles.find((p) => p.id === OWN_NAME_SCRIPT.baseProfileId)!;
describe("checkOwnName", () => {
  it("accepts letters with accents, spaces, hyphens and apostrophes, and trims extra spaces", () => {
    expect(checkOwnName("  Nguyễn   Văn  An ")).toEqual({ ok: true, name: "Nguyễn Văn An" });
    expect(checkOwnName("Mary-Jane O'Brien")).toEqual({ ok: true, name: "Mary-Jane O'Brien" });
    expect(checkOwnName("Zoë D’Arcy")).toEqual({ ok: true, name: "Zoë D’Arcy" });
    expect(checkOwnName("José\tGarcía\n")).toEqual({ ok: true, name: "José García" });
  });
  it("refuses an empty name, more than 60 characters, digits and other signs", () => {
    expect(checkOwnName("   ")).toEqual({ ok: false, problem: "empty" });
    expect(checkOwnName("a".repeat(OWN_NAME_MAX))).toEqual({ ok: true, name: "a".repeat(OWN_NAME_MAX) });
    expect(checkOwnName("a".repeat(OWN_NAME_MAX + 1))).toEqual({ ok: false, problem: "tooLong" });
    for (const bad of ["Anna 2", "A123456789", "anna@example.com", "Anna; DROP", "<b>Anna</b>", "--", "' -"]) {
      expect(checkOwnName(bad).ok, bad).toBe(false);
    }
  });
  it("never returns a name with leading, trailing or double spaces", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (raw) => {
        const r = checkOwnName(raw);
        if (r.ok) {
          expect(r.name).toBe(normaliseOwnName(r.name));
          expect(r.name).not.toMatch(/^\s|\s$|\s\s/);
          expect([...r.name].length).toBeLessThanOrEqual(OWN_NAME_MAX);
        }
      })
    );
  });
});
describe("spelling", () => {
  it("spells in English letters without accents", () => {
    expect(spellWord("Nguyễn")).toBe("N-G-U-Y-E-N");
    expect(spellWord("Đặng")).toBe("D-A-N-G");
    expect(spellWord("O'Brien")).toBe("O-B-R-I-E-N");
    expect(nameParts("Nguyễn Văn An")).toEqual(["Nguyễn", "Văn", "An"]);
    expect(spellingOfParts("Nguyễn Văn An")).toBe("Nguyễn: N-G-U-Y-E-N. Văn: V-A-N. An: A-N");
  });
});
describe("the coach with the learner's name", () => {
  const coach = createOwnNameCoach(createScriptedN400Coach(content.n400Questions), "Nguyễn Văn An");
  const answer = (questionId: string): N400Answer => ({ questionId, questionText: "", transcript: "x" });
  it("puts the name in the full-name question's sample answer and asks for the spelling next", async () => {
    const first = await coach.nextQuestion({ profile: base, answered: [] });
    expect(first?.id).toBe(OWN_NAME_SCRIPT.nameQuestionId);
    expect(first?.sampleAnswer).toBe("My name is Nguyễn Văn An.");
    const second = await coach.nextQuestion({ profile: base, answered: [answer(first!.id)] });
    expect(second?.id).toBe(OWN_NAME_SCRIPT.spelling.id);
    expect(second?.text).toBe("Can you spell your last name, please?");
    expect(second?.sampleAnswer).toContain("N-G-U-Y-E-N");
  });
  it("then asks the rest of the script with the sample profile's answers", async () => {
    const third = await coach.nextQuestion({ profile: base, answered: [answer("n400-001"), answer(OWN_NAME_SCRIPT.spelling.id)] });
    const scripted = content.n400Questions[1]!;
    expect(third).toEqual({ id: scripted.id, text: scripted.text, sampleAnswer: scripted.sampleAnswers[base.id] });
    const ids: string[] = [];
    const answered: N400Answer[] = [];
    for (let p = await coach.nextQuestion({ profile: base, answered }); p !== null; p = await coach.nextQuestion({ profile: base, answered })) {
      ids.push(p.id);
      answered.push(answer(p.id));
    }
    expect(ids).toHaveLength(content.n400Questions.length + 1);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("marks the spelling question as one the AI coach never gets", () => {
    expect(isLocalOnlyQuestion(OWN_NAME_SCRIPT.spelling.id)).toBe(true);
    expect(isLocalOnlyQuestion("n400-001")).toBe(false);
  });
  it("uses a sample profile that exists", () => {
    expect(base).toBeDefined();
    expect(content.n400Questions.some((q) => q.id === OWN_NAME_SCRIPT.nameQuestionId)).toBe(true);
  });
});
describe("protectNameForCoach", () => {
  const sample = "Aurora Thistlewood";
  const name = "Nguyễn Văn An";
  it("replaces the name with the sample profile's name", () => {
    expect(protectNameForCoach("My name is Nguyễn Văn An.", name, sample)).toBe("My name is Aurora Thistlewood.");
    expect(protectNameForCoach("my name is nguyen van an", name, sample)).toBe("my name is Aurora Thistlewood");
    expect(protectNameForCoach("I am An Nguyen.", name, sample)).toBe("I am Aurora Thistlewood.");
  });
  it("leaves ordinary words alone", () => {
    expect(protectNameForCoach("I am an engineer.", name, sample)).toBe("I am an engineer.");
    expect(protectNameForCoach("I work as a nurse.", name, sample)).toBe("I work as a nurse.");
  });
  it("never sends a spelled name: replaced when the letters are joined, refused when they stand apart", () => {
    expect(protectNameForCoach("N-G-U-Y-E-N", name, sample)).toBe(sample);
    expect(protectNameForCoach("It is n g u y e n.", name, sample)).toBeNull();
    expect(protectNameForCoach("N. G. U. Y. E. N.", name, sample)).toBeNull();
  });
  it("never lets a name part of three letters or more through (property)", () => {
    const letter = fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz");
    const part = fc.array(letter, { minLength: 3, maxLength: 9 }).map((l) => l.join(""));
    const filler = fc.constantFrom("my name is", "it is", "I am", "yes,", "call me", "");
    fc.assert(
      fc.property(fc.array(part, { minLength: 1, maxLength: 3 }), filler, fc.boolean(), (parts, before, capital) => {
        const real = parts.map((p) => (capital ? p[0]!.toUpperCase() + p.slice(1) : p)).join(" ");
        const sent = protectNameForCoach(`${before} ${real}.`, real, sample);
        if (sent === null) return;
        const lower = ` ${sent.toLowerCase().replace(/[^a-z]+/g, " ")} `;
        for (const p of parts) if (!"aurora thistlewood".includes(p)) expect(lower).not.toContain(` ${p} `);
      })
    );
  });
});
