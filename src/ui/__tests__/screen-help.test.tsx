import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { HelpSessionProvider, useHelpSeen } from "../help-session";
import { HowItWorks } from "../components/HowItWorks";
import { ScreenHelp, type HelpScreen } from "../components/ScreenHelp";

const SCREENS: HelpScreen[] = ["setup", "n400", "reading", "writing", "civics"];

describe("ScreenHelp", () => {
  it("has a button, and opens by itself the first time a screen is shown", () => {
    for (const screen of SCREENS) {
      const html = renderToString(
        <HelpSessionProvider>
          <ScreenHelp screen={screen} />
        </HelpSessionProvider>
      );
      expect(html, screen).toContain(">Help<");
      expect(html, screen).toContain('aria-expanded="true"');
      expect(html, screen).not.toMatch(/class="help__panel"[^>]*hidden/);
    }
  });

  it("stays closed once the screen was shown in this session, and the button is still there", () => {
    function Seen({ screen }: { screen: HelpScreen }) {
      useHelpSeen().add(screen);
      return <ScreenHelp screen={screen} />;
    }
    const html = renderToString(
      <HelpSessionProvider>
        <Seen screen="reading" />
      </HelpSessionProvider>
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("hidden");
    expect(html).toContain(">Help<");
  });

  it("has exactly three numbered steps on every screen", () => {
    for (const screen of SCREENS) {
      const html = renderToString(<ScreenHelp screen={screen} />);
      expect(html, screen).toContain("<ol");
      expect((html.match(/<li>/g) ?? []).length, screen).toBe(3);
    }
  });
  it("names the microphone button and typing on the screens that have a microphone", () => {
    for (const screen of ["n400", "reading", "civics"] as const) {
      const html = renderToString(<ScreenHelp screen={screen} />);
      expect(html, screen).toContain("Tap to speak");
      expect(html, screen).toContain("Or type in the box.");
    }
  });
  it("the N-400 help says nothing is scored", () => {
    const html = renderToString(<ScreenHelp screen="n400" />);
    expect(html).toContain("Nothing here gets a score.");
  });
  it("the writing help is for typing only: no microphone step", () => {
    const html = renderToString(<ScreenHelp screen="writing" />);
    expect(html).toContain("Play the sentence");
    expect(html).toContain("Type what you hear in the box.");
    expect(html).not.toContain("Tap to speak");
  });
  it("the setup help names the start button and warns against real details", () => {
    const html = renderToString(<ScreenHelp screen="setup" />);
    expect(html).toContain("Start practice");
    expect(html).toContain("Do not type your real name");
  });

  it("uses short sentences: no step is longer than 160 characters", () => {
    for (const screen of SCREENS) {
      const html = renderToString(<ScreenHelp screen={screen} />);
      for (const item of html.match(/<li>(.*?)<\/li>/g) ?? []) {
        expect(item.replace(/<[^>]+>/g, "").length, item).toBeLessThanOrEqual(160);
      }
    }
  });
});

describe("HowItWorks", () => {
  it("has three steps: listen, speak or type, see the result", () => {
    const html = renderToString(<HowItWorks />);
    expect((html.match(/<li>/g) ?? []).length).toBe(3);
    expect(html).toContain("Listen");
    expect(html).toContain("Speak or type");
    expect(html).toContain("See the result");
  });
});

describe("where the help sits on a question screen", () => {
  it("comes after the question and before the answer box, so the question stays near the top", async () => {
    const { renderToString: render } = await import("react-dom/server");
    const { EnglishScreen } = await import("../screens/EnglishScreen");
    const { createDefaultPracticeEnv, createPracticeEngine } = await import("../../engine/practice-flow");
    const env = { ...createDefaultPracticeEnv(), answerKey: () => ({ status: "locked" as const, reason: "test" }) };
    const engine = createPracticeEngine(env);
    const AT = "2026-11-17T10:00:00.000Z";
    const state = engine.reduce(engine.initial(), { type: "choose", mode: "reading", seed: 5, at: AT });
    const html = render(
      <HelpSessionProvider>
        <EnglishScreen progress={engine.englishProgress(state, "reading")} matchOptions={engine.matchOptions("reading")} onSubmit={() => {}} onContinue={() => {}} />
      </HelpSessionProvider>
    );
    const sentence = engine.englishProgress(state, "reading").current!.text.replace(/&/g, "&amp;");
    const at = (text: string) => html.indexOf(text);
    expect(at(sentence)).toBeGreaterThan(0);
    expect(at(">Help<")).toBeGreaterThan(at(sentence));
    expect(at("<textarea")).toBeGreaterThan(at(">Help<"));
  });
});
