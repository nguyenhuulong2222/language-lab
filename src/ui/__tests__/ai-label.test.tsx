/**
 * Content-safety rule 3, points a and b, on the screens: the AI label on every screen of a
 * non-English language, and the disclaimer shown together with its English text.
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { LANGUAGE_CODES, ENGLISH_MESSAGES } from "../../i18n";
import { I18nProvider } from "../../i18n/react";
import { AiNotice } from "../components/AiNotice";
import { Disclaimer } from "../components/Disclaimer";
import { Footer } from "../components/Footer";
import { Shell } from "../components/Shell";
import { HomeScreen } from "../screens/HomeScreen";
import { sessionSteps } from "../../engine/practice-flow";

const others = LANGUAGE_CODES.filter((c) => c !== "en");
const inLanguage = (code: (typeof LANGUAGE_CODES)[number], node: React.ReactNode) =>
  renderToString(<I18nProvider language={code}>{node}</I18nProvider>);

describe("the AI label", () => {
  it("is not shown in English", () => {
    expect(renderToString(<AiNotice />)).toBe("");
  });

  it("is shown in every other language, in that language and in English", () => {
    for (const code of others) {
      const html = inLanguage(code, <AiNotice />);
      expect(html, code).toContain("ai-notice");
      expect(html, code).toContain('role="note"');
      expect(html, code).toContain(ENGLISH_MESSAGES["aiNotice.text"]);
      expect(html, code).toContain('lang="en"');
    }
  });

  it("is on every screen frame, between the header and the page", () => {
    for (const code of others) {
      const html = inLanguage(
        code,
        <Shell steps={sessionSteps("reading")} currentStage="reading">
          <p>page</p>
        </Shell>
      );
      const header = html.indexOf("<header");
      const notice = html.indexOf("ai-notice");
      expect(notice, code).toBeGreaterThan(header);
      expect(notice, code).toBeLessThan(html.indexOf("<main"));
    }
  });
});

describe("the disclaimer with its English text", () => {
  it("English only in English: the text appears once", () => {
    const html = renderToString(<Disclaimer messageKey="disclaimer.short" />);
    expect(html.split(ENGLISH_MESSAGES["disclaimer.short"]).length - 1).toBe(1);
  });

  it("every other language shows the translation and the English text, for every standing disclaimer", () => {
    for (const code of others) {
      for (const key of ["disclaimer.short", "disclaimer.full", "disclaimer.report"] as const) {
        const html = inLanguage(code, <Disclaimer messageKey={key} />);
        expect(html, `${code} ${key}`).toContain(ENGLISH_MESSAGES[key]);
        expect(html, `${code} ${key}`).toContain('lang="en"');
      }
    }
  });

  it("the prominent variant carries both too", () => {
    const html = inLanguage("es", <Disclaimer variant="prominent" id="d" messageKey="disclaimer.full" />);
    expect(html).toContain(ENGLISH_MESSAGES["disclaimer.full"]);
    expect(html).toContain("Por favor, lea esto");
  });

  it("the footer disclaimer carries the English text in every other language", () => {
    for (const code of others) expect(inLanguage(code, <Footer />), code).toContain(ENGLISH_MESSAGES["disclaimer.short"]);
  });

  it("the three notices on the home screen carry their English text", () => {
    for (const code of others) {
      const html = inLanguage(code, <HomeScreen civicsLocked={false} onChoose={() => {}} />);
      for (const key of ["intro.notice.practice", "intro.notice.legal", "intro.notice.government"] as const) {
        expect(html, `${code} ${key}`).toContain(ENGLISH_MESSAGES[key]);
      }
      expect(html, code).toContain(ENGLISH_MESSAGES["disclaimer.full"]);
    }
  });
});
