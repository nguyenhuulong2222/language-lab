import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import RAW_DENY from "../../../../data/coach-deny-list.json";
import { loadCoachConfig } from "../config";
import { checkReply, loadDenyList, parseDenyList } from "../reply-check";

const config = loadCoachConfig();
const deny = loadDenyList();
const good = { followUp: "How long have you worked as a nurse?", feedback: "understood", tip: "Speak in full sentences, and say the word years clearly." };
const check = (obj: unknown, stop = "end_turn", names: string[] = ["Aurora Thistlewood"]) =>
  checkReply(typeof obj === "string" ? obj : JSON.stringify(obj), stop, config, deny, names);
const reason = (obj: unknown, stop?: string) => {
  const r = check(obj, stop);
  return r.ok ? "ok" : r.reason;
};

describe("reply check (REQ-C09)", () => {
  it("accepts a valid reply and normalises the feedback value", () => {
    expect(check(good)).toEqual({ ok: true, reply: good });
    const r = check({ ...good, feedback: "Needs_Practice" });
    expect(r.ok && r.reply.feedback).toBe("needs_practice");
  });
  it("accepts the fictional profile's own name", () => {
    expect(reason({ ...good, followUp: "Aurora Thistlewood, where do you work now?" })).toBe("ok");
  });
  it("rejects a reply that did not end normally", () => {
    expect(reason(good, "max_tokens")).toBe("stop_max_tokens");
    expect(reason(good, "refusal")).toBe("stop_refusal");
  });
  it("rejects shapes that are not the schema", () => {
    expect(reason("not json")).toBe("not_json");
    expect(reason("[1,2]")).toBe("not_object");
    expect(reason({ ...good, extra: "x" })).toBe("keys");
    expect(reason({ followUp: good.followUp, feedback: good.feedback })).toBe("keys");
    expect(reason({ ...good, tip: 3 })).toBe("types");
    expect(reason({ ...good, feedback: "passed" })).toBe("feedback_value");
    expect(reason({ ...good, tip: "  " })).toBe("empty");
  });
  it("enforces the length limits", () => {
    expect(reason({ ...good, followUp: `${"Where ".repeat(30)}?` })).toBe("followup_length");
    expect(reason({ ...good, tip: "Say each word slowly. ".repeat(20) })).toBe("tip_length");
  });
  it("English only, one question", () => {
    expect(reason({ ...good, tip: "Hãy nói chậm hơn." })).toBe("not_english");
    expect(reason({ ...good, followUp: "你在哪里工作?" })).toBe("not_english");
    expect(reason({ ...good, tip: "Eres un buen estudiante, habla despacio." })).toBe("not_english");
    expect(reason({ ...good, followUp: "Où travaillez-vous maintenant?" })).toBe("not_english");
    expect(reason({ ...good, followUp: "Tell me about your job." })).toBe("followup_not_question");
    expect(reason({ ...good, followUp: "Where do you work? And since when?" })).toBe("followup_not_question");
  });
  it("blocks URLs and identifiers", () => {
    expect(reason({ ...good, tip: "Read more at www.example.com about verbs." })).toBe("tip_url");
    expect(reason({ ...good, tip: "Practice saying 555-123-4567 slowly." })).toBe("tip_identifier");
  });
  it("blocks real officeholders, by name or by title and name", () => {
    expect(reason({ ...good, followUp: "Have you ever met Joe Biden?" })).toBe("followup_officeholder");
    expect(reason({ ...good, tip: "Speak as clearly as Obama does." })).toBe("tip_officeholder");
    expect(reason({ ...good, followUp: "Did Senator Smith help you?" })).toBe("followup_title_name");
    expect(reason({ ...good, followUp: "Who is the Speaker of the House?" })).toBe("ok");
  });
  it("blocks outcome predictions, legal advice and claim advice", () => {
    expect(reason({ ...good, tip: "Good answer, you will pass the interview." })).toBe("tip_outcome");
    expect(reason({ ...good, tip: "Your application will be approved if you speak clearly." })).toBe("tip_outcome");
    expect(reason({ ...good, tip: "Ask a lawyer about this part." })).toBe("tip_legal");
    expect(reason({ ...good, tip: "This is not legal advice, but speak slowly." })).toBe("tip_legal");
    expect(reason({ ...good, tip: "You should tell the officer you never traveled." })).toBe("tip_claim");
    expect(reason({ ...good, tip: "Do not mention the trip, and speak slowly." })).toBe("tip_claim");
  });
  it("a follow-up never asks for an identifier", () => {
    for (const q of ["What is your home address?", "What is your date of birth?", "What is your A-number?", "What is your phone number?", "Can you give me your email?"]) {
      expect(reason({ ...good, followUp: q }), q).toBe("followup_asks_identifier");
    }
  });
  it("review fixes: more claim, outcome and model-answer phrasings; government voice; first-person tips; fewer false positives", () => {
    expect(reason({ ...good, tip: "That is correct, and speak slowly." })).toBe("tip_outcome");
    expect(reason({ ...good, tip: "USCIS officers expect short answers." })).toBe("tip_outcome");
    expect(reason({ ...good, tip: "Do not say that part, speak slowly." })).toBe("tip_claim");
    expect(reason({ ...good, tip: "You might say it more slowly." })).toBe("tip_model_answer");
    expect(reason({ ...good, tip: "I have worked as a nurse for five years." })).toBe("tip_model_answer");
    expect(reason({ ...good, tip: "When you say your address, speak slowly." })).toBe("tip_identifier_words");
    expect(reason({ ...good, followUp: "Did senator O'Brien help you?" })).toBe("followup_title_name");
    expect(reason({ ...good, followUp: "Why did you apply for citizenship?" })).toBe("ok");
    expect(reason({ ...good, followUp: "Do you work for the Justice Department?" })).not.toBe("followup_title_name");
    expect(reason({ ...good, tip: "Use ‘have lived’ for time up to now, 100% of the time." })).toBe("ok");
  });
  it("a tip never gives a model answer", () => {
    expect(reason({ ...good, tip: 'You could say "I have worked as a nurse for five years."' })).toBe("tip_model_answer");
    expect(reason({ ...good, tip: "Try saying the whole sentence again." })).toBe("tip_model_answer");
    expect(reason({ ...good, tip: 'Use "have lived" for time up to now.' })).toBe("ok");
  });
  it("property: inserting any deny-list phrase into a valid tip is rejected", () => {
    const phrases = [...deny.outcomePhrases, ...deny.legalPhrases, ...deny.claimPhrases, ...deny.officeholderNames];
    fc.assert(
      fc.property(fc.constantFrom(...phrases), (phrase) => {
        const tip = `Speak slowly, ${phrase}, and use full sentences.`.slice(0, config.reply.tipMaxChars);
        return !check({ ...good, tip }).ok;
      }),
      { numRuns: 300 }
    );
  });
  it("property: inserting any identifier-request word into a valid follow-up is rejected", () => {
    fc.assert(
      fc.property(fc.constantFrom(...deny.identifierRequestWords), (word) => !check({ ...good, followUp: `Can you tell me about your ${word}?` }).ok),
      { numRuns: 100 }
    );
  });
  it("the deny-list file is valid and dated", () => {
    expect(deny.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(() => parseDenyList({ ...RAW_DENY, legalPhrases: [] })).toThrow(/legalPhrases/);
    expect(() => parseDenyList({ ...RAW_DENY, reviewedOn: "soon" })).toThrow(/reviewedOn/);
  });
});
