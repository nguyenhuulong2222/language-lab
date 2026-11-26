/**
 * Pictures for civics questions (BS-20): the data is consistent, every picture has an accepted
 * rights statement and a federal source, and the generated docs match the data.
 */
import { describe, expect, it } from "vitest";
import ANSWERS_2008 from "../../../data/civics-answers/2008.json";
import ANSWERS_2025 from "../../../data/civics-answers/2025.json";
import todo from "../../../data/images/todo.json";
import MISSES from "../../../data/images/misses.json";
import ILLUSTRATIONS_JSON from "../../../data/images/illustrations-manifest.json";
import creditsDoc from "../../../docs/image-credits.md?raw";
import reviewDoc from "../../../docs/image-review.md?raw";
import todoDoc from "../../../docs/image-todo.md?raw";
import { buildCredits, buildReview, buildTodo } from "../image-docs";
import type { IllustrationManifest } from "../illustrations";
import {
  acceptableRights,
  checkImageData,
  isFederalUrl,
  pictureForQuestion,
  PICTURE_MANIFEST,
  QUESTION_IMAGES,
  type PictureEntry,
} from "../question-images";

const questions = [...ANSWERS_2008.entries, ...ANSWERS_2025.entries].map((e) => ({
  id: e.id,
  version: e.testVersion,
  text: e.questionText,
}));
const questionIds = questions.map((q) => q.id);
const fileModules = import.meta.glob("../../../public/images/civics/*.webp", { eager: true, query: "?url", import: "default" });
const files = new Set(Object.keys(fileModules).map((k) => k.split("/").pop() as string));

describe("the picture data", () => {
  it("is consistent: files, mapping, rights, sources", () => {
    expect(checkImageData({ manifest: PICTURE_MANIFEST, mapping: QUESTION_IMAGES, questionIds, files })).toEqual([]);
  });
  it("is marked needsHumanReview", () => {
    expect(QUESTION_IMAGES.needsHumanReview).toBe(true);
  });
  it("stays under 15 MB in total", () => {
    const total = PICTURE_MANIFEST.images.reduce((n, p) => n + p.bytes, 0);
    expect(total).toBeLessThan(15_000_000);
  });
  it("every manifest entry has a non-empty rights statement", () => {
    for (const p of PICTURE_MANIFEST.images) expect(p.rights.trim().length, p.id).toBeGreaterThan(10);
  });
  it("only maps static questions, and uses question ids that exist", () => {
    const staticIds = new Set([...ANSWERS_2008.entries, ...ANSWERS_2025.entries].filter((e) => e.answerType === "static").map((e) => e.id));
    for (const q of Object.keys(QUESTION_IMAGES.questions)) expect(staticIds.has(q), q).toBe(true);
  });
  it("pictureForQuestion finds the mapped picture and null otherwise", () => {
    for (const [q, id] of Object.entries(QUESTION_IMAGES.questions)) expect(pictureForQuestion(q)?.id).toBe(id);
    expect(pictureForQuestion("2008-000")).toBeNull();
  });
});

const sample: PictureEntry = {
  id: "p1",
  file: "p1.webp",
  title: "A title",
  creator: "A creator",
  date: "1900",
  sourcePageUrl: "https://www.loc.gov/item/1/",
  fileUrl: "https://tile.loc.gov/storage-services/service/pnp/x/1v.jpg",
  rights: "No known restrictions on publication.",
  downloadedOn: "2026-11-18",
  sha256: "a".repeat(64),
  alt: "alt",
  caption: "A title",
  width: 1200,
  height: 800,
  bytes: 100000,
};
const check = (picture: Partial<PictureEntry>, map: Record<string, string> = { "2008-001": "p1" }, extraFiles: string[] = ["p1.webp"]) =>
  checkImageData({
    manifest: { images: [{ ...sample, ...picture }] },
    mapping: { needsHumanReview: true, questions: map },
    questionIds: ["2008-001"],
    files: new Set(extraFiles),
  }).map((p) => p.problem);

describe("the data checker", () => {
  it("passes a good entry", () => {
    expect(check({})).toEqual([]);
  });
  it("fails an empty rights statement", () => {
    expect(check({ rights: "" }).join("|")).toMatch(/rights is empty/);
    expect(check({ rights: "   " }).join("|")).toMatch(/rights is empty/);
  });
  it("fails a rights statement that is not accepted", () => {
    expect(check({ rights: "Rights status not evaluated." }).join("|")).toMatch(/not an accepted one/);
    expect(check({ rights: "Copyright held by Jane Doe. Used by permission." }).join("|")).toMatch(/not an accepted one/);
  });
  it("fails a missing file, an unmapped picture and a mapping to nothing", () => {
    expect(check({}, { "2008-001": "p1" }, []).join("|")).toMatch(/not in public/);
    expect(check({}, {}).join("|")).toMatch(/no question uses it/);
    expect(check({}, { "2008-001": "p1", "2008-002": "p1" }).join("|")).toMatch(/not a question id/);
    expect(check({}, { "2008-001": "zzz" }).join("|")).toMatch(/not in the manifest/);
  });
  it("fails a non-federal source and a missing hash", () => {
    expect(check({ sourcePageUrl: "https://example.com/x" }).join("|")).toMatch(/not on a U.S. federal site/);
    expect(check({ fileUrl: "http://www.loc.gov/x.jpg" }).join("|")).toMatch(/not on a U.S. federal site/);
    expect(check({ sha256: "xyz" }).join("|")).toMatch(/sha256/);
  });
  it("fails a file that is too big or not WebP", () => {
    expect(check({ bytes: 200000 }).join("|")).toMatch(/150 kB/);
    expect(check({ width: 1600 }).join("|")).toMatch(/1200px/);
    expect(check({ file: "p1.jpg" }, undefined, ["p1.jpg"]).join("|")).toMatch(/not WebP/);
  });
  it("fails a file in the folder that is not in the manifest", () => {
    expect(check({}, undefined, ["p1.webp", "stray.webp"]).join("|")).toMatch(/not in the manifest/);
  });
});

describe("accepted rights statements", () => {
  it.each([
    "No known restrictions on publication.",
    "No know restrictions on publication.",
    "No known restrictions on publication. For information see \"Anthony Angel Collection...\"",
    "Public domain",
    "U.S. Government work",
    "CC0 1.0 Universal",
    "Use restriction: Unrestricted. Access restriction: Unrestricted.",
  ])("accepts %s", (text) => expect(acceptableRights(text)).toBe(true));
  it.each([
    "",
    "Rights status not evaluated. For general information see \"Copyright and Other Restrictions...\"",
    "Publication may be restricted. For information see: \"Camilo Vergara...\"",
    "Copyright 1998 Jane Doe. All rights reserved.",
    "Courtesy of the estate. Used with permission.",
    "No known restrictions on publication, but credit line required: Photo by a Rights holder",
    "Use restriction: Restricted - Possibly. Access restriction: Unrestricted.",
    "Use restriction: Unrestricted. Access restriction: Restricted - Partly.",
    "Unrestricted",
  ])("refuses %s", (text) => expect(acceptableRights(text)).toBe(false));
  it("refuses a non-string", () => {
    expect(acceptableRights(undefined)).toBe(false);
    expect(acceptableRights(null)).toBe(false);
  });
});

describe("federal hosts", () => {
  it("accepts federal https hosts and subdomains", () => {
    for (const u of ["https://www.loc.gov/item/1/", "https://tile.loc.gov/a.jpg", "https://catalog.archives.gov/id/1", "https://www.aoc.gov/x", "https://www.nps.gov/x"]) {
      expect(isFederalUrl(u), u).toBe(true);
    }
  });
  it("refuses everything else", () => {
    for (const u of ["https://commons.wikimedia.org/x", "https://example.com/loc.gov", "https://loc.gov.evil.com/x", "http://www.loc.gov/x", "not a url", "https://flickr.com/x"]) {
      expect(isFederalUrl(u), u).toBe(false);
    }
  });
});

describe("generated docs", () => {
  it("image-credits, image-review and image-todo match the data", () => {
    const illustrations = ILLUSTRATIONS_JSON as unknown as IllustrationManifest;
    expect(creditsDoc).toBe(buildCredits(PICTURE_MANIFEST, QUESTION_IMAGES, illustrations));
    expect(reviewDoc).toBe(buildReview(PICTURE_MANIFEST, QUESTION_IMAGES, questions, illustrations));
    expect(todoDoc).toBe(buildTodo(todo, MISSES.misses));
  });
  it("the credits list every picture with its rights statement", () => {
    for (const p of PICTURE_MANIFEST.images) {
      expect(creditsDoc).toContain(p.rights);
      expect(creditsDoc).toContain(p.sourcePageUrl);
    }
  });
});
