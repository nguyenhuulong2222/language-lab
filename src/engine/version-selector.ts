/**
 * src/engine/version-selector.ts
 *
 * Chooses the civics test version from the N-400 filing date.
 *
 * The boundary date comes from data/test-rules.json (civicsTestVersionSelection.boundaryDate),
 * read through the rules loader. Source: uscis.gov, Study for the Test. Applications filed
 * before the boundary take the 2008 civics test; applications filed on or after it take the
 * 2025 civics test.
 *
 * Pure module: no time zones, no time of day, no side effects.
 */

import { loadCivicsBoundaryDate } from "./test-rules-loader.js";

export type CivicsTestVersion = "2008" | "2025";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Throw unless `date` is a real calendar date written as YYYY-MM-DD.
 * `label` names the value in the error message.
 */
export function assertValidIsoDate(date: string, label = "filing date"): void {
  const match = ISO_DATE.exec(date);
  if (!match) {
    throw new Error(`Invalid ${label} "${date}": expected the format YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Invalid ${label} "${date}": not a real calendar date.`);
  }
}

/**
 * Returns "2008" for dates strictly before the boundary and "2025" for the boundary
 * date and every date after it. Throws for a malformed or impossible date.
 *
 * `boundaryDate` defaults to the value in the test rules. Pass another value only to test
 * that the selector really reads it.
 */
export function selectTestVersion(
  filingDate: string,
  boundaryDate: string = loadCivicsBoundaryDate()
): CivicsTestVersion {
  assertValidIsoDate(filingDate);
  assertValidIsoDate(boundaryDate, "boundary date");
  return filingDate < boundaryDate ? "2008" : "2025";
}

/**
 * Throw if the version declared on a session differs from the version its filing date
 * requires. The engine never silently grades with a mismatched version.
 */
export function assertVersionConsistency(
  filingDate: string,
  declaredVersion: CivicsTestVersion,
  boundaryDate: string = loadCivicsBoundaryDate()
): void {
  const expected = selectTestVersion(filingDate, boundaryDate);
  if (expected !== declaredVersion) {
    throw new Error(
      `Test version mismatch: filing date ${filingDate} requires the ${expected} civics test, ` +
        `but the session declares ${declaredVersion}.`
    );
  }
}
