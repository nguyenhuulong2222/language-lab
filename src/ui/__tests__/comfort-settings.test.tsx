/**
 * Comfort settings (B-13): the header panels, the settings, and the layout rules that keep text
 * from being clipped when it is large. Real-browser checks of the layout are in tools/layout-check.
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import baseCss from "../styles/base.css?raw";
import tokensCss from "../styles/tokens.css?raw";
import { Header } from "../components/Header";
import { SpeakButton } from "../components/SpeakButton";
import { SettingsPanel } from "../components/SettingsPanel";
import { SettingsProvider, TEXT_SIZES } from "../settings";
import { VoiceProvider } from "../voice/VoiceProvider";
import { UNSUPPORTED_LISTENER } from "../voice/speech-listener";
import type { PromptSpeaker } from "../voice/prompt-speaker";

const cssFiles = import.meta.glob("../**/*.css", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("the header", () => {
  const html = renderToString(<Header onHome={() => {}} />);

  it("has Home (in a session), Settings and About buttons that open panels", () => {
    expect(html).toContain("Home");
    expect(html).toContain("Settings");
    expect(html).toContain("About &amp; disclaimer");
    // Language, Home (with a session), Settings and About each open a panel.
    expect((html.match(/aria-expanded="false"/g) ?? []).length).toBe(4);
    expect((html.match(/aria-controls=/g) ?? []).length).toBe(4);
  });

  it("has no Home button before a session", () => {
    const before = renderToString(<Header />);
    expect(before).not.toContain(">Home<");
    expect((before.match(/aria-expanded=/g) ?? []).length).toBe(3);
  });

  it("asks before Home throws away the answers, in a closed panel", () => {
    expect(html).toContain("Your answers in this practice will be lost.");
    expect(html).toContain("Yes, go home");
    expect(html).toContain("Stay here");
    expect(html).toMatch(/header__panel"[^>]*hidden/);
  });

  it("the settings panel has no heading, so the page heading stays first", () => {
    const settings = renderToString(<SettingsProvider><SettingsPanel onClose={() => {}} /></SettingsProvider>);
    expect(settings).not.toMatch(/<h[1-6]/);
    expect(settings).toContain('role="group"');
  });

  it("holds the comfort settings in a closed panel", () => {
    expect(html).toMatch(/class="[^"]*header__panel"[^>]*hidden/);
    expect(html).toContain("Comfort settings");
  });
});

describe("the settings panel", () => {
  const html = renderToString(
    <SettingsProvider>
      <SettingsPanel onClose={() => {}} />
    </SettingsProvider>
  );

  it("offers three text sizes, normal selected, as radio buttons", () => {
    expect((html.match(/name="text-size"/g) ?? []).length).toBe(TEXT_SIZES.length);
    for (const label of ["Normal", "Large", "Extra large"]) expect(html).toContain(label);
    expect(html).toMatch(/value="normal"[^>]*checked|checked[^>]*value="normal"/);
  });

  it("offers slower playback, off at first, and says it is the same recording", () => {
    expect(html).toContain("Play recorded voices more slowly");
    expect(html).toContain("It is the same recording.");
    expect(html).toMatch(/type="checkbox"/);
    expect(html).not.toMatch(/type="checkbox"[^>]*checked/);
  });

  it("says the settings are kept for this page only", () => {
    expect(html).toContain("These settings last until you close or reload this page.");
  });
});

describe("settings are kept in memory only", () => {
  it("nothing in the settings code uses browser storage", async () => {
    const files = import.meta.glob("../settings.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const code = Object.values(files).join("\n");
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
  });
});

describe("text size styles", () => {
  it("scale the root size: 18px normal, 21px large, 24px extra large, so every rem size follows", () => {
    // Senior-friendly step 1: the default (normal) is already 18px, because settings are not stored.
    expect(baseCss).toMatch(/html\s*\{\s*font-size:\s*112\.5%/);
    expect(baseCss).toMatch(/html\[data-text-size="large"\]\s*\{\s*font-size:\s*131\.25%/);
    expect(baseCss).toMatch(/html\[data-text-size="extra-large"\]\s*\{\s*font-size:\s*150%/);
  });

  it("make the tap target at least 56px at normal size and let it grow", () => {
    // Senior-friendly step 2: 56px (was 48px).
    expect(tokensCss).toMatch(/--tap-min:\s*max\(56px,\s*3\.1112rem\)/);
  });

  it("do not stop text from wrapping, except for screen-reader-only text and the skip link", () => {
    for (const [file, css] of Object.entries(cssFiles)) {
      const blocks = css.split("}");
      for (const block of blocks) {
        if (!/white-space:\s*nowrap/.test(block)) continue;
        expect(block, file).toMatch(/\.ll-sr-only|\.ll-skip-link/);
      }
    }
  });

  it("no control has a fixed pixel height or width", () => {
    for (const [file, css] of Object.entries(cssFiles)) {
      if (file.endsWith("tokens.css")) continue;
      for (const block of css.split("}")) {
        if (/\.ll-sr-only|\.ll-skip-link|stepper__connector/.test(block)) continue;
        expect(block, file).not.toMatch(/(?:^|\s)(?:min-)?(?:width|height):\s*\d+px/);
      }
    }
  });
});

describe("Play again", () => {
  const speaker: PromptSpeaker = {
    available: true,
    voiceFor: () => "device-voice",
    speak: () => Promise.resolve(),
    cancel: () => {},
  };

  it("is offered once the audio has been played; before that the first button is Play aloud", () => {
    const html = renderToString(
      <VoiceProvider speaker={speaker} listener={UNSUPPORTED_LISTENER}>
        <SpeakButton text="Hello." />
      </VoiceProvider>
    );
    expect(html).toContain("Play aloud");
    expect(html).not.toContain("Play again");
  });
});
