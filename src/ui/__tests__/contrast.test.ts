/**
 * Colour contrast of the design tokens (formN400 style, light only), read from tokens.css itself so
 * the test follows any change to the palette:
 * - text pairs (body and small text, links, button text on navy): 7:1 or more (WCAG AAA);
 * - large text and icon pairs (red labels, muted large text, the result colours, white on the red
 *   recording button): 4.5:1 or more;
 * - control edges (--ink-2) and the focus ring: 3:1 or more against every background.
 */
import { describe, expect, it } from "vitest";
import CSS from "../styles/tokens.css?raw";
const NAMES = [
  "bg", "surface", "surface-2", "ink", "ink-2", "ink-3", "accent", "accent-mid", "accent-light", "red", "on-accent",
  "correct", "correct-bg", "wrong", "wrong-bg", "notice-bg",
] as const;
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
const BACKGROUNDS: Name[] = ["bg", "surface", "surface-2", "notice-bg", "correct-bg", "wrong-bg"];
const TEXT: Array<[Name, Name]> = [
  ...BACKGROUNDS.flatMap((bg): Array<[Name, Name]> => [["ink", bg], ["ink-2", bg], ["accent", bg], ["accent-mid", bg]]),
  ["on-accent", "accent"],
  ["on-accent", "accent-mid"],
];
const LARGE: Array<[Name, Name]> = [
  ...BACKGROUNDS.flatMap((bg): Array<[Name, Name]> => [["red", bg], ["ink-3", bg]]),
  ["correct", "correct-bg"],
  ["correct", "surface"],
  ["wrong", "wrong-bg"],
  ["wrong", "surface"],
  ["on-accent", "red"],
];
const EDGES: Array<[Name, Name]> = BACKGROUNDS.flatMap((bg): Array<[Name, Name]> => [["ink-2", bg], ["accent-light", bg]]);
describe("contrast of the design tokens", () => {
  it("checks the formula against known values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });
  it("light only: no dark theme block, and the page asks for the light scheme", () => {
    expect(CSS).not.toContain('data-theme="dark"');
    expect(CSS).not.toContain("prefers-color-scheme");
    expect(CSS).toContain("color-scheme: light");
  });
  const p = LIGHT;
  it("every text pair is 7:1 or more", () => {
    for (const [fg, bg] of TEXT) expect(contrast(p[fg], p[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(7);
  });
  it("every large-text and icon pair is 4.5:1 or more", () => {
    for (const [fg, bg] of LARGE) expect(contrast(p[fg], p[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
  it("control edges and the focus ring are 3:1 or more on every background", () => {
    for (const [fg, bg] of EDGES) expect(contrast(p[fg], p[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
  });
  it("the formN400 values are used as given (no value had to change for contrast)", () => {
    expect(p).toMatchObject({ bg: "#f7f8fc", surface: "#ffffff", ink: "#0d1f3c", "ink-2": "#334166", "ink-3": "#5d6b87", accent: "#0d2052", red: "#b22234", correct: "#128040", wrong: "#ca1f1f" });
  });
});
