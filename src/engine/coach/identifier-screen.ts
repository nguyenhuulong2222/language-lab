/**
 * src/engine/coach/identifier-screen.ts
 *
 * Screens a learner's answer for obvious personal identifiers before anything is sent to the AI
 * coach (spec REQ-C08). Used by the client and again by the server, and on the model's reply.
 * Narrow patterns on purpose: years alone, counts and short numbers pass. Digits said as words
 * ("two zero zero") are out of scope. Names are not detected at all: a name looks like any other
 * word, so the notice says so (`coach.notice.limits`). A guard against accidents, not a privacy
 * guarantee.
 *
 * Pure module: no DOM, no network.
 */
import type { IdentifierKind } from "./types.js";

/**
 * Street addresses (audit F-08): a house number, one to three words, then a street word. The words
 * in between may not be common short words or time words, so "in 2015 we moved to a new street" and
 * "I have 2 kids on our street" pass. Unit markers ("Apt 4", "Unit 2B", "Suite 300", "#12") count too.
 */
const STREET_WORD = "(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|hwy|highway)";
const NOT_A_NAME_WORD =
  "(?!(?:a|an|the|to|in|on|at|by|for|of|and|or|my|our|your|his|her|their|we|i|new|old|same|this|that|years?|months?|weeks?|days?|hours?|times?|kids|children|people|blocks?|miles?|minutes?)\\b)";
const STREET = new RegExp(`\\b\\d{1,6}[a-z]?\\s+(?:${NOT_A_NAME_WORD}[a-z][a-z.'-]*\\s+){1,3}${STREET_WORD}\\b`, "i");
const UNIT = /\b(?:apt|apartment|unit|suite|ste)\.?\s*#?\s*\d+[a-z]?\b|(?<=[a-z]\s)#\s?\d+[a-z]?\b/i;
/** The 50 states, DC and the territories: two-letter codes (capitals only) and full names. */
const STATE_CODE =
  "(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR|GU|VI|AS|MP)";
const STATE_NAME =
  "(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia|puerto rico|guam)";
/** A ZIP code next to a state: "CA 90210", "California, 90210-1234", "90210 CA". */
const ZIP_STATE = [
  new RegExp(`\\b${STATE_CODE},?\\s+\\d{5}(?:-\\d{4})?(?!\\d)`),
  new RegExp(`\\b${STATE_NAME},?\\s+\\d{5}(?:-\\d{4})?(?!\\d)`, "i"),
  new RegExp(`(?<!\\d)\\d{5}(?:-\\d{4})?,?\\s+${STATE_CODE}\\b`),
];

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

/** Checked in this order; the first kind that matches is reported. */
const PATTERNS: ReadonlyArray<readonly [IdentifierKind, RegExp]> = [
  ["email", /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/],
  ["ssn", /(?<!\d)\d{3}[-.\s]\d{2}[-.\s]\d{4}(?!\d)/],
  ["phone", /(?<![\d+])(?:\+?1[-.\s]?)?(?:\(\d{3}\)\s?|\d{3}[-.\s]?)\d{3}[-.\s]?\d{4}(?!\d)/],
  ["phone", /(?<!\d)\d{10,11}(?!\d)/],
  ["date-of-birth", /(?<!\d)\d{1,2}[/.-]\d{1,2}[/.-](?:\d{4}|\d{2})(?![\d/.-]?\d)/],
  ["date-of-birth", /(?<!\d)\d{4}[/.-]\d{1,2}[/.-]\d{1,2}(?!\d)/],
  ["date-of-birth", new RegExp(`\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, "i")],
  ["date-of-birth", new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\.?,?\\s+\\d{4}\\b`, "i")],
  // Before the 9-digit A-number shape, so "CA 90210-1234" is named a ZIP code.
  ["street-address", STREET],
  ["street-address", UNIT],
  ...ZIP_STATE.map((pattern) => ["zip-code", pattern] as const),
  ["a-number", /\bA[-\s]?\d{7,9}(?!\d)/i],
  ["a-number", /(?<!\d)(?:\d[\s-]?){8}\d(?!\d)/],
];

/** The kind of identifier found in the text, or null when none is. */
export function screenIdentifiers(text: string): IdentifierKind | null {
  for (const [kind, pattern] of PATTERNS) if (pattern.test(text)) return kind;
  return null;
}
