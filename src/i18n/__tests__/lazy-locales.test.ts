/**
 * Only English is in the first download; other locales are fetched when chosen (audit PERF-01).
 * locale-status.json, which the menu reads instead, must match the locale files.
 */
import { describe, expect, it } from "vitest";
import indexSource from "../index.ts?raw";
import statusFile from "../locale-status.json";
import { buildLocaleStatus } from "../locale-status-build";
import { loadLocale, isLocaleLoaded, LOCALE_STATUS } from "../index";
const files = import.meta.glob<Record<string, unknown>>("../locales/*.json", { eager: true, import: "default" });
const locales = Object.fromEntries(Object.entries(files).map(([f, raw]) => [/([a-z]+)\.json$/.exec(f)![1]!, raw]));
describe("lazy locales", () => {
  it("locale-status.json is up to date (run tools/i18n/build-locale-status.mjs)", () => {
    expect(statusFile).toEqual(buildLocaleStatus(locales as never));
  });
  it("index.ts imports only English eagerly; the others are a lazy glob", () => {
    const eager = [...indexSource.matchAll(/^import [^\n]+ from "\.\/locales\/([a-z]+)\.json";/gm)].map((m) => m[1]);
    expect(eager).toEqual(["en"]);
    expect(indexSource).toContain('import.meta.glob<RawLocale>(["./locales/*.json", "!./locales/en.json"], { import: "default" })');
    expect(indexSource).not.toContain("eager: true");
  });
  it("the status of every locale comes from the status file, without loading it", () => {
    for (const [code, entry] of Object.entries(statusFile)) expect(LOCALE_STATUS[code as "vi"], code).toEqual(entry.meta);
  });
  it("loading a language that is loaded already resolves true", async () => {
    expect(isLocaleLoaded("vi")).toBe(true);
    expect(await loadLocale("vi")).toBe(true);
    expect(await loadLocale("en")).toBe(true);
  });
});
