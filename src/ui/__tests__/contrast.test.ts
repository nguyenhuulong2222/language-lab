/**
 * Colour contrast of the design tokens (senior-friendly step 7), read from tokens.css itself so the
 * test follows any change to the palette. Light and dark mode:
 * - text pairs (body and small text, links, button text on teal): 7:1 or more (WCAG AAA);
 * - large text and icon pairs (amber, the text on an amber button): 4.5:1 or more;
 * - control borders: 3:1 or more against every background.
 */
import { describe, expect, it } from "vitest";
import CSS from "../styles/tokens.css?raw";
const NAMES = ["bg", "surface", "surface-2", "ink", "ink-2", "teal", "amber", "border", "on-accent"] as const;
type Name = (typeof NAMES)[number];
type Palette = Record<Name, string>;

function block(selector: string): string {
  const start = CSS.indexOf(selector);
  if (start < 0) throw new Error(`no ${selector} block in tokens.css`);
  const open = CSS.indexOf("{", start);
  return CSS.slice(open + 1, CSS.indexOf("}", open));
}
function palette(body: string): Palette {
  const out = {} as Palette;
  for (const name of NAMES) {
    const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(body);
    if (match === null) throw new Error(`--${name} is not a hex colour in this block`);
    out[name] = match[1]!;
  }
  return out;
}
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const LIGHT = palette(block(":root {"));
const DARK = palette(block(':root[data-theme="dark"]'));
const DARK_SYSTEM = palette(block(':root:not([data-theme="light"])'));
const BACKGROUNDS: Name[] = ["bg", "surface", "surface-2"];
const TEXT: Array<[Name, Name]> = [
  ...BACKGROUNDS.flatMap((bg): Array<[Name, Name]> => [["ink", bg], ["ink-2", bg], ["teal", bg]]),
  ["on-accent", "teal"],
];
const LARGE: Array<[Name, Name]> = [...BACKGROUNDS.map((bg): [Name, Name] => ["amber", bg]), ["on-accent", "amber"]];
const BORDERS: Array<[Name, Name]> = BACKGROUNDS.map((bg): [Name, Name] => ["border", bg]);

describe("contrast of the design tokens", () => {
  it("checks the formula against known values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });
  it("dark mode is the same whether chosen or taken from the system setting", () => {
    expect(DARK_SYSTEM).toEqual(DARK);
  });
  for (const [mode, p] of [["light", LIGHT], ["dark", DARK]] as const) {
    it(`${mode}: every text pair is 7:1 or more`, () => {
      for (const [fg, bg] of TEXT) expect(contrast(p[fg], p[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(7);
    });
    it(`${mode}: every large-text and icon pair is 4.5:1 or more`, () => {
      for (const [fg, bg] of LARGE) expect(contrast(p[fg], p[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode}: control borders are 3:1 or more on every background`, () => {
      for (const [fg, bg] of BORDERS) expect(contrast(p[fg], p[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
    });
  }
});
