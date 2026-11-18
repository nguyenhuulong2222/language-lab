#!/usr/bin/env node
/**
 * tools/i18n/build-vi-review.mjs
 *
 * Writes docs/vi-locale-review.md from the English and Vietnamese locale files.
 *
 *   node --no-warnings tools/i18n/build-vi-review.mjs
 *
 * Needs Node 22.18 or newer (it imports the TypeScript module directly).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReviewSheet } from "../../src/i18n/review-sheet.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const en = read("src/i18n/locales/en.json");
const { _meta, ...vi } = read("src/i18n/locales/vi.json");
const sheet = buildReviewSheet({ en, vi });
fs.writeFileSync(path.join(ROOT, "docs/vi-locale-review.md"), sheet);
console.log(`wrote docs/vi-locale-review.md (${Object.keys(en).length} lines, needsHumanReview: ${_meta?.needsHumanReview})`);
