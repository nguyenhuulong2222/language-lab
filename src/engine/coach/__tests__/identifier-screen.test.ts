import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { screenIdentifiers } from "../identifier-screen";
import { loadPracticeContent } from "../../practice-content";

describe("identifier screen (REQ-C08)", () => {
  const positive: Array<[string, string]> = [
    ["My A-number is A123456789.", "a-number"],
    ["a 12345678", "a-number"],
    ["number A-1234567", "a-number"],
    ["it is 123 456 789", "a-number"],
    ["123456789", "a-number"],
    ["my social is 123-45-6789", "ssn"],
    ["123 45 6789", "ssn"],
    ["call me at (555) 123-4567", "phone"],
    ["555-123-4567", "phone"],
    ["+1 555 123 4567", "phone"],
    ["5551234567", "phone"],
    ["15551234567", "phone"],
    ["write to me@example.com", "email"],
    ["first.last+tag@mail.co.uk", "email"],
    ["I was born on 01/02/1990", "date-of-birth"],
    ["born 1-2-90", "date-of-birth"],
    ["1990-01-02", "date-of-birth"],
    ["January 2, 1990", "date-of-birth"],
    ["on the 3rd of March 1985", "date-of-birth"],
  ];
  it("finds each kind", () => {
    for (const [text, kind] of positive) expect(screenIdentifiers(text), text).toBe(kind);
  });
  const negative = [
    "I have lived in the United States for seven years.",
    "I came here in 2018 and moved in 2020.",
    "I have 3 children and 2 dogs.",
    "I work 40 hours a week at a hospital.",
    "My name is Juniper Hale.",
    "I visited my family for two weeks last year.",
    "Room 12, floor 4.",
    "It cost about 1500 dollars.",
    "I was born in March.",
    "From 2010 to 2015 I lived in Texas.",
    "two zero zero one two three",
  ];
  it("lets ordinary answers through", () => {
    for (const text of negative) expect(screenIdentifiers(text), text).toBeNull();
  });
  it("lets every sample answer of the fictional profiles through", () => {
    const content = loadPracticeContent();
    for (const q of content.n400Questions) for (const answer of Object.values(q.sampleAnswers)) expect(screenIdentifiers(answer), answer).toBeNull();
  });
  it("property: prose without digits or @ never flags", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[A-Za-z]{1,10}$/), { maxLength: 30 }), (words) => screenIdentifiers(words.join(" ")) === null),
      { numRuns: 300 }
    );
  });
  it("property: any 9-digit run, inside any text, flags", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9]{9}$/), fc.stringMatching(/^[a-z ]{0,20}$/), fc.stringMatching(/^[a-z ]{0,20}$/), (digits, before, after) =>
        screenIdentifiers(`${before} ${digits} ${after}`) !== null
      ),
      { numRuns: 300 }
    );
  });
  it("property: any e-mail shape flags", () => {
    // Common shapes (letters, digits, dot, plus, dash, underscore); exotic RFC local parts are out of scope.
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9][a-z0-9._+-]{0,15}$/), fc.stringMatching(/^[a-z0-9-]{1,12}$/), fc.constantFrom("com", "org", "net", "co.uk", "edu"), (local, host, tld) =>
        screenIdentifiers(`write ${local}@${host}.${tld} please`) === "email"
      ),
      { numRuns: 200 }
    );
  });
});
