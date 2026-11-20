/**
 * Screen text lives in src/i18n/locales/. This test reads the UI source and fails when a
 * component has literal text between tags, or a literal in a text attribute.
 */
import { describe, it, expect } from "vitest";

const sources = import.meta.glob("../**/*.tsx", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

const files = Object.entries(sources).filter(([file]) => !file.includes("__tests__") && !/\.test\./.test(file));

/** Text between a closing > and an opening <, with at least one letter and no braces. */
const JSX_TEXT = />\s*([^<>{}\n][^<>{}]*)\s*</g;
const TEXT_ATTRIBUTES = /\b(?:aria-label|aria-description|title|alt|placeholder|label)="([^"]*[A-Za-z][^"]*)"/g;

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("no hard-coded screen text in src/ui", () => {
  it("finds the UI files", () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  for (const [file, raw] of files) {
    it(file, () => {
      const text = stripComments(raw);
      const literals: string[] = [];
      for (const match of text.matchAll(JSX_TEXT)) {
        const found = match[1]!.trim();
        // "=>", "&&" and other code between > and < are not JSX text.
        if (/[A-Za-z]/.test(found) && !/=>|&&|\|\||\?|;|\bconst\b|\breturn\b/.test(found)) literals.push(found);
      }
      for (const match of text.matchAll(TEXT_ATTRIBUTES)) literals.push(match[0]);
      expect(literals).toEqual([]);
    });
  }
});
