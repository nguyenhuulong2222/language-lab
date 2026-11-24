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

describe("street addresses and ZIP codes (audit F-08)", () => {
  const positive: Array<[string, string]> = [
    ["I live at 123 Main Street.", "street-address"],
    ["12 Oak St", "street-address"],
    ["4500 North Lake Shore Drive", "street-address"],
    ["77 Elm Ave apartment 3", "street-address"],
    ["1600 Pennsylvania Avenue", "street-address"],
    ["9 Ocean View Rd", "street-address"],
    ["250 Mission Blvd", "street-address"],
    ["31 Maple Ln", "street-address"],
    ["8 Cherry Way", "street-address"],
    ["15 Birch Ct", "street-address"],
    ["2200 Pacific Coast Hwy", "street-address"],
    ["my apartment is Apt 4B", "street-address"],
    ["Unit 12", "street-address"],
    ["Suite 300", "street-address"],
    ["building #12", "street-address"],
    ["Honolulu, HI 96813", "zip-code"],
    ["Los Angeles CA 90012-3456", "zip-code"],
    ["in California 94105", "zip-code"],
    ["New York, 10001", "zip-code"],
    ["90210 CA", "zip-code"],
  ];
  it("finds a house number with a street word, a unit, and a ZIP code next to a state", () => {
    for (const [text, kind] of positive) expect(screenIdentifiers(text), text).toBe(kind);
  });
  const negative = [
    "In 2015 we moved to a new street.",
    "I have 2 kids on our street.",
    "We lived 3 blocks from the main road.",
    "There is only 1 way to do it.",
    "I drive 20 miles to work on the highway.",
    "I worked 5 days a week at a store on that street.",
    "I lived in California for 10 years.",
    "I moved to Texas in 2019.",
    
    "My doctor is Dr Lee.",
    "I visited 4 states.",
    "We are number 1 in our team.",
  ];
  it("lets ordinary answers through", () => {
    for (const text of negative) expect(screenIdentifiers(text), text).toBeNull();
  });
  it("a five-digit number after a state name is read as a ZIP code (narrow, on purpose)", () => {
    expect(screenIdentifiers("I was in New York for 12345 reasons.")).toBeNull();
    expect(screenIdentifiers("New York 12345")).toBe("zip-code");
  });
  it("lets every sample answer of the fictional profiles through", () => {
    const content = loadPracticeContent();
    for (const q of content.n400Questions) for (const answer of Object.values(q.sampleAnswers)) expect(screenIdentifiers(answer), answer).toBeNull();
  });
  const streetWords = ["Street", "St", "Avenue", "Ave", "Road", "Rd", "Blvd", "Drive", "Dr", "Lane", "Ln", "Way", "Ct", "Hwy"];
  const nameWord = fc.stringMatching(/^[A-Z][a-z]{2,9}$/).filter((w) => !/^(?:The|And|For|Our|New|Old|Same|This|That|Years?|Days?|Kids|Miles?)$/i.test(w));
  it("property: any house number, one to three name words and a street word flags", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99999 }), fc.array(nameWord, { minLength: 1, maxLength: 3 }), fc.constantFrom(...streetWords), (n, words, street) => {
        expect(screenIdentifiers(`I live at ${n} ${words.join(" ")} ${street}.`)).toBe("street-address");
      })
    );
  });
  it("property: any state code with any ZIP code flags; the same digits alone do not", () => {
    fc.assert(
      fc.property(fc.constantFrom("CA", "TX", "NY", "HI", "FL", "WA"), fc.integer({ min: 10000, max: 99999 }), (state, zip) => {
        expect(screenIdentifiers(`Springfield, ${state} ${zip}`)).toBe("zip-code");
        expect(screenIdentifiers(`I paid ${zip} dollars.`)).toBeNull();
      })
    );
  });
  it("property: time and count phrases never flag as an address", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2030 }),
        fc.constantFrom("years", "days", "weeks", "months", "hours", "times", "kids", "children", "blocks", "miles"),
        fc.constantFrom("on the street", "near the road", "by the highway", "on our street", "down the lane"),
        (n, unit, place) => {
          expect(screenIdentifiers(`I spent ${n} ${unit} ${place}.`)).toBeNull();
        }
      )
    );
  });
});
