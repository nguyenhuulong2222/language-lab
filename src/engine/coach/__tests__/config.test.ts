import { describe, expect, it } from "vitest";
import RAW from "../../../../data/coach-config.json";
import { loadCoachConfig, parseCoachConfig } from "../config";

const clone = (): Record<string, any> => JSON.parse(JSON.stringify(RAW));
const withChange = (path: string, value: unknown) => {
  const raw = clone();
  const parts = path.split(".");
  let obj = raw;
  for (const p of parts.slice(0, -1)) obj = obj[p];
  obj[parts[parts.length - 1]!] = value;
  return raw;
};

describe("coach config (data/coach-config.json)", () => {
  it("loads with the values of the spec (REQ-C10)", () => {
    const c = loadCoachConfig();
    expect(c.model).toMatchObject({ id: "claude-haiku-5-5", apiVersion: "2026-10-21", maxTokens: 300, effort: "low", thinking: "disabled", temperature: null });
    expect(c.limits).toMatchObject({
      maxAnswerChars: 600, maxRequestBytes: 4096, maxTurnsPerSession: 12, perIpPerHour: 30, perIpPerDay: 80,
      dailyRequestBudget: 600, dailySpendCapUsd: 0.5, upstreamTimeoutMs: 8000, clientTimeoutMs: 12000,
    });
    expect(c.origins.exact).toContain("https://language-lab-ade.pages.dev");
    expect(c.origins.exact).toContain("https://lab.formn400.org");
    expect(c.origins.previewSuffix).toBe(".language-lab-ade.pages.dev");
  });
  it("temperature must be null: API version 2026-10-21 rejects it", () => {
    for (const bad of [0, 0.2, 1, "0.5"]) expect(() => parseCoachConfig(withChange("model.temperature", bad))).toThrow(/temperature/);
  });
  it("rejects every limit out of range", () => {
    const cases: Array<[string, unknown]> = [
      ["limits.maxAnswerChars", 0], ["limits.maxAnswerChars", 1.5], ["limits.maxRequestBytes", 100],
      ["limits.maxTurnsPerSession", 0], ["limits.perIpPerHour", -1], ["limits.perIpPerDay", "80"],
      ["limits.dailyRequestBudget", 0], ["limits.dailySpendCapUsd", 0], ["limits.dailySpendCapUsd", 1000],
      ["limits.upstreamTimeoutMs", 10], ["limits.clientTimeoutMs", 5000], ["model.maxTokens", 5000],
      ["model.effort", "max"], ["model.thinking", "adaptive"], ["model.id", "gpt-4"], ["reply.tipMaxChars", 5],
    ];
    for (const [path, value] of cases) expect(() => parseCoachConfig(withChange(path, value)), `${path}=${String(value)}`).toThrow(/coach-config/);
  });
  it("rejects inconsistent limits", () => {
    expect(() => parseCoachConfig(withChange("limits.perIpPerHour", 100))).toThrow(/perIpPerDay/);
    expect(() => parseCoachConfig(withChange("limits.maxAnswerChars", 1500))).toThrow(/maxRequestBytes/);
  });
  it("rejects unknown settings and http origins other than localhost", () => {
    expect(() => parseCoachConfig(withChange("limits.maxAnswerCharz", 10))).toThrow(/not a known setting/);
    expect(() => parseCoachConfig(withChange("origins.exact", ["http://example.com"]))).toThrow(/localhost/);
    expect(() => parseCoachConfig(withChange("origins.previewSuffix", "pages.dev"))).toThrow(/previewSuffix/);
  });
});
