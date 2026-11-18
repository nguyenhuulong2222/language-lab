/**
 * Decision (docs/decisions-log.md, "Translations stay hidden"): the civics translation display
 * is not mounted on any screen yet. This test fails if App.tsx or a file in src/ui/screens/
 * refers to TranslatedQuestion, loadCivicsDisplay or the civics-translations module.
 * Remove or change this test only together with that decision.
 */
import { describe, it, expect } from "vitest";

const screens = import.meta.glob("../screens/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const app = import.meta.glob("../App.tsx", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

const files = { ...screens, ...app };

const FORBIDDEN = /TranslatedQuestion|loadCivicsDisplay|civics-translations/;

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("translations stay hidden", () => {
  it("looks at App.tsx and at least one screen", () => {
    const names = Object.keys(files);
    expect(names.some((n) => n.endsWith("/App.tsx"))).toBe(true);
    expect(names.some((n) => n.includes("/screens/"))).toBe(true);
  });

  for (const [file, raw] of Object.entries(files)) {
    it(`${file} does not use the translation display`, () => {
      expect(FORBIDDEN.test(stripComments(raw))).toBe(false);
    });
  }

  it("the check itself detects a use", () => {
    expect(FORBIDDEN.test('import { TranslatedQuestion } from "../components/TranslatedQuestion";')).toBe(true);
    expect(FORBIDDEN.test('const m = await import("../../i18n/civics-translations");')).toBe(true);
  });
});
