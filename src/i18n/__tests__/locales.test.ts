/**
 * Automated checks on every interface locale (content-safety rule 3, condition c): same keys,
 * same {placeholders}, same numbers, fixed terms kept, nothing empty, nothing left in English
 * except the allow-list. Plus unit tests of the checker, so a weak checker cannot pass a
 * bad locale.
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import enRaw from "../locales/en.json";
import backTranslations from "../review/back-translations.json";
import { CATALOGS, LOCALE_STATUS } from "../index";
import {
  checkLocale,
  checkMeta,
  FIXED_TERMS,
  IDENTICAL_ALLOWED,
  normaliseDigits,
  numbersIn,
  placeholdersIn,
} from "../locale-checks";
import { LANGUAGE_CODES } from "../languages";

const en = enRaw as Record<string, string>;
const OTHER = LANGUAGE_CODES.filter((c) => c !== "en");

describe.each(OTHER)("locale %s", (code) => {
  const messages = CATALOGS[code] as Record<string, string>;
  it("passes every check", () => {
    expect(checkLocale(en, messages)).toEqual([]);
  });
  it("has a valid _meta: ai-draft, no reviewer yet", () => {
    const meta = LOCALE_STATUS[code];
    expect(checkMeta(meta)).toEqual([]);
    expect(meta?.source).toBe("ai-draft");
    expect(meta?.reviewedBy).toBeNull();
    expect(meta?.reviewedOn).toBeNull();
  });
  it("has the same keys as English, no empty text", () => {
    expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
    for (const text of Object.values(messages)) expect(text.trim().length).toBeGreaterThan(0);
  });
  it("keeps the fixed terms wherever English has them", () => {
    for (const [key, source] of Object.entries(en)) {
      for (const term of FIXED_TERMS) if (source.includes(term)) expect(messages[key], key).toContain(term);
    }
  });
  it("leaves in English only the allow-listed lines", () => {
    const same = Object.keys(en).filter((k) => messages[k] === en[k]);
    expect(same.filter((k) => !IDENTICAL_ALLOWED.includes(k))).toEqual([]);
  });
  it("has back-translations for the legal lines", () => {
    const bt = (backTranslations.backTranslations as Record<string, Record<string, string>>)[code];
    for (const key of backTranslations.keys) expect(bt?.[key]?.trim().length, key).toBeGreaterThan(0);
  });
});

describe("the checker", () => {
  const base = { a: "Open {name} on page 3.", b: "USCIS and N-400", c: "Hello" };
  it("passes a faithful translation", () => {
    expect(checkLocale(base, { a: "Abra {name} en la página 3.", b: "USCIS y N-400", c: "Hola" })).toEqual([]);
  });
  it("catches a missing key, an extra key and empty text", () => {
    const kinds = checkLocale(base, { a: "x {name} 3", c: "  ", z: "new" }).map((p) => `${p.key}:${p.kind}`);
    expect(kinds).toContain("b:missing-key");
    expect(kinds).toContain("c:empty");
    expect(kinds).toContain("z:extra-key");
  });
  it("catches a lost or renamed placeholder", () => {
    expect(checkLocale(base, { a: "Abra en la página 3.", b: "USCIS N-400", c: "Hola" })[0]?.kind).toBe("placeholders");
    expect(checkLocale(base, { a: "Abra {nombre} 3.", b: "USCIS N-400", c: "Hola" })[0]?.kind).toBe("placeholders");
  });
  it("catches a changed number, also in native digits", () => {
    expect(checkLocale(base, { a: "Abra {name} 4.", b: "USCIS N-400", c: "Hola" })[0]?.kind).toBe("numbers");
    expect(checkLocale({ a: "Page 3 of 10" }, { a: "หน้า ๓ จาก ๑๐" })).toEqual([]);
    expect(checkLocale({ a: "Page 3 of 10" }, { a: "หน้า ๔ จาก ๑๐" })[0]?.kind).toBe("numbers");
    expect(checkLocale({ a: "Part 6" }, { a: "ပိုင်း ၆" })).toEqual([]);
    expect(checkLocale({ a: "Part 6" }, { a: "भाग ६" })).toEqual([]);
    expect(checkLocale({ a: "Part 6" }, { a: "第６部分" })).toEqual([]);
  });
  it("catches a translated fixed term", () => {
    expect(checkLocale(base, { a: "Abra {name} 3.", b: "USCIS y N 400", c: "Hola" })[0]?.kind).toBe("fixed-term");
    expect(checkLocale({ a: "Language Lab" }, { a: "Laboratorio de idiomas" })[0]?.kind).toBe("fixed-term");
  });
  it("catches text left in English, except on the allow-list", () => {
    expect(checkLocale(base, { ...base, a: "Abra {name} 3.", b: "USCIS N-400" })[0]?.key).toBe("c");
    expect(checkLocale({ "app.name": "Language Lab" }, { "app.name": "Language Lab" })).toEqual([]);
  });
  it("normalises digits of every script back to ASCII", () => {
    expect(normaliseDigits("٠١٢ ۳۴ ५६ ๗๘ ໙໐ ၁၂ ３")).toBe("012 34 56 78 90 12 3");
  });
  it("properties: placeholders and numbers survive any surrounding text", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }).filter((s) => !/[\d{}]/.test(s)), fc.nat(9999), (words, n) => {
        const source = `Say {x} ${n}`;
        const translated = `${words} {x} ${n}`;
        expect(placeholdersIn(translated)).toEqual(placeholdersIn(source));
        expect(numbersIn(translated)).toEqual(numbersIn(source));
      })
    );
  });
});

describe("the back-translation file", () => {
  it("covers all 13 languages and only keys that exist", () => {
    expect(Object.keys(backTranslations.backTranslations).sort()).toEqual([...OTHER].sort());
    for (const key of backTranslations.keys) expect(en[key], key).toBeDefined();
    for (const [code, notes] of Object.entries(backTranslations.differs)) {
      expect(OTHER).toContain(code);
      for (const key of Object.keys(notes)) expect(backTranslations.keys).toContain(key);
    }
  });
});
