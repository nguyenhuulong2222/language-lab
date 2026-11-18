import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { productionLocaleText } from "./strip-draft-locale.mjs";

const draft = JSON.stringify({ _meta: { needsHumanReview: true, note: "draft" }, "app.name": "Texte", "x": "Chữ" });
const reviewed = JSON.stringify({ _meta: { needsHumanReview: false, reviewedBy: "A", reviewedOn: "2026-01-01" }, "app.name": "Texte" });

describe("productionLocaleText", () => {
  it("keeps only _meta of a draft: none of its text ships", () => {
    const out = JSON.parse(productionLocaleText("vi", draft)) as Record<string, unknown>;
    expect(Object.keys(out)).toEqual(["_meta"]);
    expect((out["_meta"] as { needsHumanReview: boolean }).needsHumanReview).toBe(true);
    expect(productionLocaleText("vi", draft)).not.toContain("Chữ");
  });

  it("ships a reviewed file unchanged", () => {
    expect(productionLocaleText("vi", reviewed)).toBe(reviewed);
  });

  it("treats a file with no _meta, or a missing flag, as a draft", () => {
    expect(Object.keys(JSON.parse(productionLocaleText("vi", JSON.stringify({ a: "b" }))))).toEqual(["_meta"]);
    expect(Object.keys(JSON.parse(productionLocaleText("vi", JSON.stringify({ _meta: {}, a: "b" }))))).toEqual(["_meta"]);
    expect((JSON.parse(productionLocaleText("vi", JSON.stringify({ a: "b" }))) as { _meta: { needsHumanReview: boolean } })._meta.needsHumanReview).toBe(true);
  });

  it("never touches English", () => {
    const en = JSON.stringify({ "app.name": "Language Lab" });
    expect(productionLocaleText("en", en)).toBe(en);
  });

  it("property: a draft never carries a message through", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string({ minLength: 1 }).filter((k) => k !== "_meta"), fc.string()), (messages) => {
        const text = JSON.stringify({ _meta: { needsHumanReview: true }, ...messages });
        const out = JSON.parse(productionLocaleText("vi", text)) as Record<string, unknown>;
        return Object.keys(out).length === 1 && "_meta" in out;
      }),
      { numRuns: 200 }
    );
  });
});
