/**
 * Tests for src/engine/version-selector.ts
 *
 * The boundary date is tested on both sides. Property tests compare against an independent
 * oracle built on Date arithmetic (not on string comparison).
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  CIVICS_2025_BOUNDARY_DATE,
  selectTestVersion,
  assertVersionConsistency,
  assertValidIsoDate,
} from "../version-selector.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The boundary date shifted by a number of days, as YYYY-MM-DD. */
function shiftBoundary(days: number): string {
  const base = Date.parse(`${CIVICS_2025_BOUNDARY_DATE}T00:00:00Z`);
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

const validDate = fc
  .date({
    min: new Date(Date.UTC(1000, 0, 1)),
    max: new Date(Date.UTC(9999, 11, 31)),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString().slice(0, 10));

describe("selectTestVersion", () => {
  it("maps the day before the boundary to 2008", () => {
    expect(selectTestVersion("2025-10-19")).toBe("2008");
  });

  it("maps the boundary date to 2025", () => {
    expect(CIVICS_2025_BOUNDARY_DATE).toBe("2025-10-20");
    expect(selectTestVersion("2025-10-20")).toBe("2025");
  });

  it("maps the day after the boundary to 2025", () => {
    expect(selectTestVersion("2025-10-21")).toBe("2025");
  });

  it("maps clearly earlier and later dates", () => {
    expect(selectTestVersion("2024-01-01")).toBe("2008");
    expect(selectTestVersion("2008-01-01")).toBe("2008");
    expect(selectTestVersion("2026-06-15")).toBe("2025");
  });

  it("handles month and year edges around the boundary", () => {
    expect(selectTestVersion("2025-09-30")).toBe("2008");
    expect(selectTestVersion("2025-10-01")).toBe("2008");
    expect(selectTestVersion("2025-11-01")).toBe("2025");
    expect(selectTestVersion("2024-10-20")).toBe("2008");
    expect(selectTestVersion("2026-10-20")).toBe("2025");
  });

  it("throws on malformed dates", () => {
    for (const bad of ["20251020", "not-a-date", "", "2025-1-20", "2025/10/20", "2025-10-20T00:00:00Z", " 2025-10-20"]) {
      expect(() => selectTestVersion(bad), `"${bad}"`).toThrow(/YYYY-MM-DD/);
    }
  });

  it("throws on impossible calendar dates", () => {
    for (const bad of ["2025-02-30", "2025-13-01", "2025-00-10", "2025-04-31", "2025-10-00", "2025-10-32", "2023-02-29", "1900-02-29"]) {
      expect(() => selectTestVersion(bad), bad).toThrow(/not a real calendar date/);
    }
  });

  it("accepts real leap days", () => {
    expect(() => assertValidIsoDate("2024-02-29")).not.toThrow();
    expect(() => assertValidIsoDate("2000-02-29")).not.toThrow();
  });
});

describe("assertVersionConsistency", () => {
  it("does not throw when the declared version matches the filing date", () => {
    expect(() => assertVersionConsistency("2025-10-19", "2008")).not.toThrow();
    expect(() => assertVersionConsistency("2025-10-20", "2025")).not.toThrow();
  });

  it("throws when the declared version does not match", () => {
    expect(() => assertVersionConsistency("2025-10-19", "2025")).toThrow(/mismatch/i);
    expect(() => assertVersionConsistency("2025-10-20", "2008")).toThrow(/mismatch/i);
  });

  it("names both versions and the date in the error", () => {
    expect(() => assertVersionConsistency("2025-10-20", "2008")).toThrow(
      /2025-10-20.*2025.*2008/
    );
  });

  it("throws for an invalid filing date", () => {
    expect(() => assertVersionConsistency("nope", "2008")).toThrow(/YYYY-MM-DD/);
  });
});

describe("selectTestVersion properties", () => {
  it("property: every valid date maps to exactly one version, matching a Date-based oracle", () => {
    fc.assert(
      fc.property(validDate, (date) => {
        const version = selectTestVersion(date);
        const isBefore =
          Date.parse(`${date}T00:00:00Z`) <
          Date.parse(`${CIVICS_2025_BOUNDARY_DATE}T00:00:00Z`);
        return isBefore ? version === "2008" : version === "2025";
      }),
      { numRuns: 500 }
    );
  });

  it("property: the version never goes back from 2025 to 2008 as dates increase", () => {
    fc.assert(
      fc.property(validDate, validDate, (a, b) => {
        const [earlier, later] = a <= b ? [a, b] : [b, a];
        return !(selectTestVersion(earlier) === "2025" && selectTestVersion(later) === "2008");
      }),
      { numRuns: 500 }
    );
  });

  it("property: every date before the boundary is 2008, the boundary and every later date is 2025", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), (offset) => {
        const before = offset === 0 ? null : shiftBoundary(-offset);
        const onOrAfter = shiftBoundary(offset);
        const beforeOk = before === null || selectTestVersion(before) === "2008";
        return beforeOk && selectTestVersion(onOrAfter) === "2025";
      }),
      { numRuns: 300 }
    );
  });

  it("property: impossible month or day numbers always throw", () => {
    const year = fc.integer({ min: 1000, max: 9999 }).map(String);
    fc.assert(
      fc.property(year, fc.integer({ min: 13, max: 99 }), (y, month) => {
        try {
          selectTestVersion(`${y}-${month}-10`);
          return false;
        } catch {
          return true;
        }
      })
    );
    fc.assert(
      fc.property(year, fc.integer({ min: 32, max: 99 }), (y, day) => {
        try {
          selectTestVersion(`${y}-10-${day}`);
          return false;
        } catch {
          return true;
        }
      })
    );
  });

  it("property: scoring the same date twice gives the same version", () => {
    fc.assert(
      fc.property(validDate, (date) => selectTestVersion(date) === selectTestVersion(date))
    );
  });
});
