/**
 * src/engine/coach/identifier-screen.ts
 *
 * Screens a learner's answer for obvious personal identifiers before anything is sent to the AI
 * coach (spec REQ-C08). Used by the client and again by the server, and on the model's reply.
 * Narrow patterns on purpose: years alone, counts and short numbers pass. Digits said as words
 * ("two zero zero") are out of scope. A guard against accidents, not a privacy guarantee.
 *
 * Pure module: no DOM, no network.
 */
import type { IdentifierKind } from "./types.js";

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
  ["a-number", /\bA[-\s]?\d{7,9}(?!\d)/i],
  ["a-number", /(?<!\d)(?:\d[\s-]?){8}\d(?!\d)/],
];

/** The kind of identifier found in the text, or null when none is. */
export function screenIdentifiers(text: string): IdentifierKind | null {
  for (const [kind, pattern] of PATTERNS) if (pattern.test(text)) return kind;
  return null;
}
