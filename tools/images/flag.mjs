/**
 * tools/images/flag.mjs
 *
 * The 50-star U.S. flag, drawn from the law:
 *   - 4 U.S.C. § 1: thirteen horizontal stripes, alternate red and white; the union has white stars
 *     on a blue field.
 *   - 4 U.S.C. § 2: one star for each state (50).
 *   - Executive Order 10834 (1959), section 2 and its chart: the proportions
 *     A (hoist) 1.0, B (fly) 1.9, C (union hoist) 0.5385, D (union fly) 0.76,
 *     E = F 0.054, G = H 0.063, K (star diameter) 0.0616, L (stripe width) 0.0769.
 *     Stars sit in 9 rows (6, 5, 6, ... 6) and 11 columns, on the points of a grid spaced E
 *     vertically and G horizontally, starting E from the top and G from the hoist of the union.
 * Colours: Old Glory Red #B22234 and Old Glory Blue #3C3B6E (common sRGB values for the
 * standard flag colours; the law names the colours, not these numbers).
 *
 * Pure: no dependencies, no I/O. Used by tools/images/draw-diagrams.mjs and by the tests.
 */
export const FLAG = { A: 1.0, B: 1.9, C: 0.5385, D: 0.76, E: 0.054, F: 0.054, G: 0.063, H: 0.063, K: 0.0616, L: 0.0769 };
export const FLAG_RED = "#B22234";
export const FLAG_BLUE = "#3C3B6E";
/** Stripes (top to bottom) and star centres, in hoist units (A = 1). */
export function flagShapes() {
  const stripes = [];
  for (let i = 0; i < 13; i++) stripes.push({ y: i * FLAG.L, height: FLAG.L, color: i % 2 === 0 ? "red" : "white" });
  const stars = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 11; col++) {
      if ((row + col) % 2 !== 0) continue;
      stars.push({ x: FLAG.G * (col + 1), y: FLAG.E * (row + 1), row, col });
    }
  }
  return { stripes, stars, union: { width: FLAG.D, height: FLAG.C } };
}
/** Points of a five-pointed star of diameter d (outer radius d/2), one point up. */
function starPoints(cx, cy, d) {
  const R = d / 2;
  const r = R * 0.381966; // inner radius of a regular star pentagram
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}
/** The flag as an SVG string, `height` pixels tall (width = 1.9 × height). */
export function flagSvg(height = 600) {
  const s = height; // pixels per hoist unit
  const w = Math.round(FLAG.B * s);
  const { stripes, stars, union } = flagShapes();
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${s}" viewBox="0 0 ${w} ${s}">`];
  out.push(`<rect width="${w}" height="${s}" fill="#FFFFFF"/>`);
  for (const st of stripes) {
    if (st.color === "red") out.push(`<rect class="stripe stripe--red" x="0" y="${(st.y * s).toFixed(2)}" width="${w}" height="${(st.height * s).toFixed(2)}" fill="${FLAG_RED}"/>`);
    else out.push(`<rect class="stripe stripe--white" x="0" y="${(st.y * s).toFixed(2)}" width="${w}" height="${(st.height * s).toFixed(2)}" fill="#FFFFFF"/>`);
  }
  out.push(`<rect class="union" x="0" y="0" width="${(union.width * s).toFixed(2)}" height="${(union.height * s).toFixed(2)}" fill="${FLAG_BLUE}"/>`);
  for (const st of stars) out.push(`<polygon class="star" points="${starPoints(st.x * s, st.y * s, FLAG.K * s)}" fill="#FFFFFF"/>`);
  out.push("</svg>");
  return out.join("");
}
