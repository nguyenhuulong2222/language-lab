/**
 * Permanent SSR render test for the report screen against mock/session.json.
 *
 * Renders the whole App shell server-side (no DOM needed) and asserts the
 * report's structure and copy: tape-counter overline, encouraging headline,
 * fictional profile card, one card per stage summary, the overall review
 * list, the prominent + footer disclaimers, the generated timestamp, and the
 * stepper marking the report as the current stage.
 *
 * Note: React inserts HTML comment markers between adjacent JSX text
 * expressions during SSR (e.g. "TAKE <!-- -->06"), so assertions avoid
 * spanning expression boundaries and only match contiguous strings.
 */
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { App } from "../App";
import { mockSession } from "../session-fixture";

describe("Report screen (SSR against session.json)", () => {
  const html = renderToString(<App session={mockSession} />);

  it("renders the report panel, not the not-built placeholder", () => {
    expect(html).toContain('class="report"');
    expect(html).not.toContain("built yet");
  });

  it("renders the tape-counter overline above the headline", () => {
    expect(html).toContain("report__overline");
    expect(html).toContain(">TAKE");
    expect(html).toContain("06</span>");
    expect(html).toContain("Practice report");
  });

  it("renders the encouraging headline with a curly apostrophe", () => {
    expect(html).toContain("You’re on track");
  });

  it("renders the fictional profile card", () => {
    expect(html).toContain("Practice profile (fictional)");
    expect(html).toContain("Aurora Vance");
    expect(html).toContain("civics test");
    expect(html).toContain("March 15, 2024");
  });

  it("renders a card for each stage summary", () => {
    expect(html).toContain("How each part went");
    expect(html).toContain("Welcome");
    expect(html).toContain("N-400 conversation");
    expect(html).toContain("Reading");
    expect(html).toContain("Writing");
    expect(html).toContain("Civics");
    expect(html).toContain("On track");
    expect(html).toContain("Worth reviewing");
  });

  it("renders the overall review list", () => {
    expect(html).toContain("Things to review");
    expect(html).toContain(
      "Review the name of the current President of the United States."
    );
  });

  it("renders the prominent and footer disclaimers", () => {
    expect(html).toContain("Please read this");
    expect(html).toContain("This is a practice tool only.");
    expect(html).toContain("Not legal advice");
  });

  it("renders the generated timestamp and marks the report stage current", () => {
    expect(html).toContain("Report generated");
    expect(html).toContain("March 20, 2024 at 10:42 AM");
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Interview stages");
  });
});
