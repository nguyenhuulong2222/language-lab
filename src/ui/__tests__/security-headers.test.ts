/**
 * public/_headers: the strict CSP and the other security headers (audit SEC-01, SEC-02), and no
 * third-party origin anywhere in the shipped HTML or CSS (fonts are self-hosted).
 */
import { describe, expect, it } from "vitest";
import headers from "../../../public/_headers?raw";
import indexHtml from "../../../index.html?raw";
import fontsCss from "../styles/fonts.css?raw";
const fontFiles = Object.keys(import.meta.glob("../../../public/fonts/*", { query: "?url", eager: true })).map((p) => p.split("/").pop());
const csp = /Content-Security-Policy: (.+)/.exec(headers)?.[1] ?? "";
const directive = (name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(name + " ")) ?? "";
describe("public/_headers", () => {
  it("has the strict CSP", () => {
    expect(directive("default-src")).toBe("default-src 'self'");
    expect(directive("script-src")).toBe("script-src 'self'");
    expect(directive("style-src")).toBe("style-src 'self'");
    expect(directive("font-src")).toBe("font-src 'self'");
    expect(directive("connect-src")).toBe("connect-src 'self'");
    expect(directive("media-src")).toContain("blob:");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
    expect(directive("form-action")).toBe("form-action 'none'");
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
  });
  it("allows no remote origin and no unsafe keyword", () => {
    expect(csp).not.toMatch(/https?:/);
    expect(csp).not.toContain("unsafe-");
  });
  it("sets the other security headers", () => {
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("Referrer-Policy: no-referrer");
    expect(headers).toMatch(/Permissions-Policy: .*microphone=\(self\)/);
  });
  it("sets cache rules for hashed assets, fonts and the page", () => {
    expect(headers).toMatch(/\/assets\/\*\s+Cache-Control: public, max-age=31536000, immutable/);
    expect(headers).toMatch(/\/fonts\/\*\s+Cache-Control: public, max-age=31536000, immutable/);
    expect(headers).toMatch(/\/index\.html\s+Cache-Control: no-cache/);
  });
});
describe("fonts are self-hosted", () => {
  it("index.html loads nothing from another origin", () => {
    expect(indexHtml).not.toMatch(/(src|href)="https?:/);
  });
  it("every font file named in fonts.css exists, with the licence beside them", () => {
    const css = fontsCss;
    expect(css).not.toMatch(/https?:/);
    for (const m of css.matchAll(/url\("\/fonts\/([^"]+)"\)/g)) expect(fontFiles, m[1]).toContain(m[1]);
    expect(fontFiles).toContain("OFL.txt");
  });
});
