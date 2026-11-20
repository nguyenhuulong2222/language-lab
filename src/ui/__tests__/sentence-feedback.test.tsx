/**
 * Honest feedback (BS-25): plain lines instead of a crossed-out display, a clear "counts" or "not
 * yet", and one line under every result saying what the result rests on.
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SentenceFeedback } from "../components/SentenceFeedback";
import { compareSentence } from "../../engine/sentence-compare";
import { loadPracticeConfig, matchOptionsFor } from "../../engine/practice-config";
import type { SentenceAttempt } from "../../engine/practice-flow";
import { I18nProvider } from "../../i18n/react";

const config = loadPracticeConfig();
const options = (kind: "reading" | "writing") => matchOptionsFor(config, kind);

function attemptFor(target: string, transcript: string, kind: "reading" | "writing", input: "voice" | "typed"): SentenceAttempt {
  const c = compareSentence(target, transcript, options(kind));
  return { sentenceId: "x", transcript, alternativesScored: 1, usedAlternative: 0, input, accuracy: c.accuracy, isCorrect: c.isCorrect, at: "2026-11-18T00:00:00Z" };
}
/** The visible text of some HTML: tags removed, the few entities React writes turned back. */
const plain = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const render = (target: string, transcript: string, kind: "reading" | "writing" = "reading", input: "voice" | "typed" = "voice", language: "en" | "vi" = "en") =>
  renderToString(
    <I18nProvider language={language}>
      <SentenceFeedback target={target} attempt={attemptFor(target, transcript, kind, input)} matchOptions={options(kind)} kind={kind} />
    </I18nProvider>
  );

describe("plain lines for near misses", () => {
  it("the iPhone case: You said “elect”. The sentence says “elects”. This still counts.", () => {
    const html = render("Who elects the President?", "who elect the president");
    expect(html).toContain("This counts.");
    expect(plain(html)).toContain("You said “elect”. The sentence says “elects”. This still counts.");
    expect(html).not.toContain("Not yet.");
  });
  it("a typed attempt says “You wrote”", () => {
    const html = render("Citizens can vote.", "citizen can vote", "writing", "typed");
    expect(plain(html)).toContain("You wrote “citizen”. The sentence says “citizens”. This still counts.");
  });
  it("a misspelling in writing still counts and asks to check the spelling", () => {
    const html = render("Citizens can vote.", "citzens can vote", "writing", "typed");
    expect(html).toContain("This counts.");
    expect(plain(html)).toContain("You wrote “citzens”. The sentence has “citizens”. This still counts. Check the spelling.");
  });
  it("a different word does not count, and says which", () => {
    const html = render("Who was George Washington?", "who was george lincoln");
    expect(html).toContain("Not yet.");
    expect(plain(html)).toContain("You said “lincoln”. The sentence says “washington”. That is a different word, so this does not count yet.");
  });
  it("a missing content word does not count", () => {
    const html = render("We pay taxes.", "we taxes");
    expect(html).toContain("Not yet.");
    expect(plain(html)).toContain("A word is missing: “pay”. This does not count yet.");
  });
  it("a left-out short word still counts and the line says so", () => {
    const html = render("What is the capital of the United States?", "what is capital of united states");
    expect(html).toContain("This counts.");
    expect(plain(html)).toContain("The short word “the” was left out. This still counts.");
    expect(html).toContain("Every important word of the sentence was there, in order.");
  });
  it("an added short word and one extra content word still count", () => {
    expect(plain(render("We pay taxes.", "we pay the taxes"))).toContain("You added the short word “the”. This still counts.");
    expect(plain(render("We pay taxes.", "we really pay taxes"))).toContain("You added “really”, which is not in the sentence. This still counts.");
  });
  it("too many extra words do not count", () => {
    const html = render("We pay taxes.", "we really truly pay taxes");
    expect(html).toContain("Not yet.");
    expect(plain(html)).toContain("You added “really”, which is not in the sentence. This does not count yet.");
  });
  it("a perfect attempt says every important word was there", () => {
    const html = render("We pay taxes.", "we pay taxes");
    expect(html).toContain("This counts.");
    expect(html).toContain("Every important word of the sentence was there, in order.");
  });
  it("nothing heard says so", () => {
    const html = render("We pay taxes.", "");
    expect(html).toContain("Not yet.");
    expect(html).toContain("We did not hear anything");
  });
});

describe("English words inside translated lines", () => {
  it("are marked lang=en so a screen reader says them in English", () => {
    const html = render("Who elects the President?", "who elect the president", "reading", "voice", "vi");
    expect(html).toContain('<span lang="en">elect</span>');
    expect(html).toContain('<span lang="en">elects</span>');
    expect(plain(html)).toContain("“elect”");
  });
});

describe("the honest line", () => {
  const heard = "This result is based on the words your device heard. If it heard you wrong, try again or type your answer.";
  it("is under every spoken result, whether it counts or not", () => {
    for (const said of ["we pay taxes", "we taxes", "", "zzz", "we pay the taxes"]) {
      expect(render("We pay taxes.", said), said).toContain(heard);
    }
  });
  it("is the typed version for typed answers and for writing", () => {
    expect(render("We pay taxes.", "we pay", "reading", "typed")).toContain("This result is based on the words you typed.");
    expect(render("We pay taxes.", "we pay taxes", "writing", "typed")).toContain("This result is based on the words you typed.");
    expect(render("We pay taxes.", "we pay", "reading", "typed")).not.toContain("your device heard");
  });
  it("is left out when a typed answer was empty (a skip): there are no typed words to base it on", () => {
    expect(render("We pay taxes.", "", "reading", "typed")).not.toContain("This result is based on");
    expect(render("We pay taxes.", "", "reading", "voice")).toContain("This result is based on the words your device heard");
  });
  it("exists in every language", () => {
    expect(render("We pay taxes.", "we taxes", "reading", "voice", "vi")).toContain("Kết quả này dựa trên những từ thiết bị của bạn nghe được");
  });
});

describe("no crossed-out or dashed display", () => {
  it("has no diff markup and no legend", () => {
    const html = render("We pay taxes.", "we really truly taxes");
    expect(html).not.toMatch(/diff__word|class="diff"|Dashed|Crossed-out|<del|<s>|line-through/);
  });
  it("shows what we heard and the sentence", () => {
    const html = render("We pay taxes.", "we pay taxes");
    expect(html).toContain("What we heard");
    expect(html).toContain("The sentence");
  });
});
