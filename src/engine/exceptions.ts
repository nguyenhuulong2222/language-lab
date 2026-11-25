/**
 * The three USCIS age and residency exceptions, counted at the time of filing (USCIS, "Exceptions
 * and Accommodations", and the Policy Manual, Vol. 12, Part E, Ch. 2, table of exceptions; saved in
 * data/sources/; decisions log Q):
 *
 * - 50/20: age 50 or older, a permanent resident for 20 years or more. Exempt from English; the
 *   normal civics test (2008 or 2025 by filing date), which may be taken in their own language with
 *   an interpreter.
 * - 55/15: age 55 or older, a permanent resident for 15 years or more. The same as 50/20.
 * - 65/20: age 65 or older, a permanent resident for 20 years or more. Exempt from English; civics
 *   with the specially designated questions (the 20 starred ones), also with an interpreter.
 *
 * "none" is the usual test. Pure module.
 */
export type AgeException = "none" | "50/20" | "55/15" | "65/20";

/** In the order the learner sees them. */
export const AGE_EXCEPTIONS: readonly AgeException[] = ["none", "50/20", "55/15", "65/20"];

export function isAgeException(value: unknown): value is AgeException {
  return typeof value === "string" && (AGE_EXCEPTIONS as readonly string[]).includes(value);
}

/** Exempt from the English requirement (no reading and no writing test): 50/20, 55/15 and 65/20. */
export function englishExempt(exception: AgeException): boolean {
  return exception !== "none";
}

/** Civics with the specially designated questions and rules: 65/20 only. */
export function usesDesignatedSet(exception: AgeException): boolean {
  return exception === "65/20";
}
