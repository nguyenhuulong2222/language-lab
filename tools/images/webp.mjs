/**
 * tools/images/webp.mjs
 *
 * Converts a downloaded or generated image to an optimised WebP: longest side at most 1200px and
 * about 145 kB or less. Fine engravings need a lower quality or a smaller size to fit. Returns the
 * quality used, or -1 when no setting fits. Needs ImageMagick (`magick`) with WebP support.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
export function toWebp(input, output) {
  for (const side of [1200, 1050, 900, 780]) {
    for (const quality of [82, 74, 66, 58, 50, 42]) {
      execFileSync("magick", [input + "[0]", "-auto-orient", "-resize", `${side}x${side}>`, "-strip", "-quality", String(quality), "-define", "webp:method=6", output]);
      if (fs.statSync(output).size <= 145_000) return quality;
    }
  }
  return -1;
}
/** Width and height of an image file. */
export function imageSize(file) {
  return execFileSync("magick", ["identify", "-format", "%w %h", file]).toString().split(" ").map(Number);
}
