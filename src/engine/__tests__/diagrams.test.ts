/**
 * Diagrams drawn from federal data (kind "diagram"): files exist and fit the limits, every question
 * id exists, no diagram is paired with a DYNAMIC or NONE question, unreviewed diagrams never show,
 * and the flag the drawing code produces has exactly 50 stars and 13 stripes.
 */
import { describe, expect, it } from "vitest";
import ANSWERS_2008 from "../../../data/civics-answers/2008.json";
import ANSWERS_2025 from "../../../data/civics-answers/2025.json";
import CLASSES_JSON from "../../../data/images/question-classes.json";
import MAPPING_JSON from "../../../data/images/question-images.json";
import { flagShapes, flagSvg, FLAG } from "../../../tools/images/flag.mjs";
import { checkDiagramData, diagramAsPicture, diagramForQuestion, DIAGRAMS, DIAGRAM_LEGAL_BASIS, type DiagramEntry, type DiagramManifest } from "../diagrams";
import { pictureUrl } from "../question-images";
const classes = (CLASSES_JSON as { classes: Record<string, string> }).classes;
const questionIds = [...ANSWERS_2008.entries, ...ANSWERS_2025.entries].map((e) => e.id);
const pictured = new Set(Object.keys((MAPPING_JSON as { questions: Record<string, string> }).questions));
const fileModules = import.meta.glob("../../../public/images/diagrams/*.webp", { eager: true, query: "?url", import: "default" });
const files = new Set(Object.keys(fileModules).map((k) => k.split("/").pop() as string));
const sample = (over: Partial<DiagramEntry> = {}): DiagramEntry => ({ ...DIAGRAMS.images.find((d) => d.id === "mexico-border-states")!, ...over });
describe("the diagram data", () => {
  it("is consistent: files, sizes, sources, questions", () => {
    expect(checkDiagramData({ manifest: DIAGRAMS, classes, questionIds, files, pictured })).toEqual([]);
  });
  it("has every diagram file, within 1200px and 150 kB", () => {
    expect(DIAGRAMS.images.length).toBeGreaterThan(0);
    for (const d of DIAGRAMS.images) {
      expect(files.has(d.file), d.file).toBe(true);
      expect(Math.max(d.width, d.height), d.id).toBeLessThanOrEqual(1200);
      expect(d.bytes, d.id).toBeLessThanOrEqual(150_000);
    }
  });
  it("uses only question ids that exist, never a DYNAMIC or NONE question", () => {
    const known = new Set(questionIds);
    for (const d of DIAGRAMS.images) {
      for (const q of d.questions) {
        expect(known.has(q), `${d.id} ${q}`).toBe(true);
        expect(["DYNAMIC", "NONE"], `${d.id} ${q}`).not.toContain(classes[q]);
      }
    }
  });
  it("states the legal basis and a 'Drawn from' credit line on every diagram", () => {
    for (const d of DIAGRAMS.images) {
      expect(d.legalBasis).toBe(DIAGRAM_LEGAL_BASIS);
      expect(d.creditLine).toMatch(/^Drawn from /);
    }
  });
  it("says 'today's state borders' in the caption of the 13 original states", () => {
    expect(DIAGRAMS.images.find((d) => d.id === "thirteen-original-states")?.caption).toContain("today's state borders");
  });
});
describe("the 50-star flag", () => {
  it("has exactly 50 stars and 13 stripes in the drawing code's output", () => {
    const { stars, stripes } = flagShapes();
    expect(stars).toHaveLength(50);
    expect(stripes).toHaveLength(13);
    expect(stripes.filter((s) => s.color === "red")).toHaveLength(7);
    const svg = flagSvg(600);
    expect(svg.match(/<polygon class="star"/g)).toHaveLength(50);
    expect(svg.match(/<rect class="stripe /g)).toHaveLength(13);
  });
  it("puts the stars in 9 rows of 6 and 5, and uses the Executive Order 10834 proportions", () => {
    const rows = new Map<number, number>();
    for (const s of flagShapes().stars) rows.set(s.row, (rows.get(s.row) ?? 0) + 1);
    expect([...rows.values()]).toEqual([6, 5, 6, 5, 6, 5, 6, 5, 6]);
    expect(FLAG.B / FLAG.A).toBeCloseTo(1.9, 5);
    expect(FLAG.L * 13).toBeCloseTo(1, 2);
    expect(FLAG.C).toBeCloseTo(FLAG.L * 7, 3);
  });
  it("is recorded with those counts in the manifest", () => {
    expect(DIAGRAMS.images.find((d) => d.id === "us-flag-50")?.counts).toEqual({ stars: 50, stripes: 13 });
  });
});
describe("diagramForQuestion", () => {
  const one = (d: DiagramEntry): DiagramManifest => ({ images: [d] });
  it("returns a reviewed diagram", () => {
    expect(diagramForQuestion("2008-093", one(sample({ reviewed: true })), classes)?.id).toBe("mexico-border-states");
  });
  it("never returns an unreviewed one", () => {
    expect(diagramForQuestion("2008-093", one(sample({ reviewed: false })), classes)).toBeNull();
  });
  it("never returns one for a DYNAMIC or NONE question, even if the manifest pairs it", () => {
    for (const cls of ["DYNAMIC", "NONE"]) {
      const q = Object.entries(classes).find(([, c]) => c === cls)![0];
      expect(diagramForQuestion(q, one(sample({ reviewed: true, questions: [q] })), classes), cls).toBeNull();
    }
  });
  it("is shown through the picture component with its own folder and credit line", () => {
    const p = diagramAsPicture(sample());
    expect(p.kind).toBe("diagram");
    expect(pictureUrl(p)).toBe(`/images/diagrams/${p.file}`);
    expect(p.creator).toBe("Drawn from U.S. Census Bureau data");
    expect(p.rights).toBe(DIAGRAM_LEGAL_BASIS);
  });
});
describe("checkDiagramData refuses", () => {
  const run = (d: DiagramEntry) => checkDiagramData({ manifest: { images: [d] }, classes, questionIds, files }).map((p) => p.problem).join("\n");
  it("a DYNAMIC or NONE question, a missing question, and a non-federal source", () => {
    const dyn = Object.entries(classes).find(([, c]) => c === "DYNAMIC")![0];
    expect(run(sample({ questions: [dyn] }))).toContain("which is DYNAMIC");
    expect(run(sample({ questions: ["2008-999"] }))).toContain("does not exist");
    expect(run(sample({ sources: [{ id: "x", publisher: "x", url: "https://example.com/a.zip", downloadedOn: "2026-11-26", sha256: "a".repeat(64) }] }))).toContain("not a Census Bureau or USGS URL");
  });
  it("an oversized or missing file and a wrong legal basis", () => {
    const p = run(sample({ file: "nope.webp", bytes: 200_000, width: 1600, legalBasis: "CC BY" }));
    expect(p).toContain("not in public/images/diagrams/");
    expect(p).toContain("over the 150 kB target");
    expect(p).toContain("over 1200px");
    expect(p).toContain("legal basis");
  });
});
