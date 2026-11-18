import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { TranslatedQuestion } from "../components/TranslatedQuestion";
import type { CivicsDisplay } from "../../i18n/civics-translations";

const english = { question: "How many amendments does the Constitution have?", answers: ["twenty-seven (27)"] };

describe("TranslatedQuestion", () => {
  it("shows English and the reference note next to a translation", () => {
    const display: CivicsDisplay = {
      kind: "translated",
      id: "2008-007",
      language: "vi",
      english,
      translated: { question: "Hiến Pháp có bao nhiêu tu chính án?", answers: ["hai mươi bảy (27)"], status: "source" },
    };
    const html = renderToString(<TranslatedQuestion display={display} showAnswers />);
    expect(html).toContain("How many amendments does the Constitution have?");
    expect(html).toContain("Hiến Pháp có bao nhiêu tu chính án?");
    expect(html).toContain('lang="vi"');
    expect(html).toContain("Tiếng Việt");
    expect(html).toContain("Translation for reference; the English version is official.");
    expect(html).toContain("twenty-seven (27)");
    expect(html).toContain("hai mươi bảy (27)");
  });

  it("hides answers by default", () => {
    const display: CivicsDisplay = { kind: "english", id: "2008-007", english };
    const html = renderToString(<TranslatedQuestion display={display} />);
    expect(html).not.toContain("twenty-seven");
    expect(html).not.toContain("Translation for reference");
  });

  it("shows English and says there is no translation yet", () => {
    const display: CivicsDisplay = { kind: "untranslated", id: "2008-007", language: "hmn", english };
    const html = renderToString(<TranslatedQuestion display={display} />);
    expect(html).toContain("How many amendments does the Constitution have?");
    expect(html).toContain("No translation yet. Showing English.");
    expect(html).not.toContain("Translation for reference");
  });
});
