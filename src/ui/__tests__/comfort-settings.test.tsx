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
import { Footer } from "../components/Footer";
import { SettingsProvider, TEXT_SIZES } from "../settings";
import { VoiceProvider } from "../voice/VoiceProvider";
import { UNSUPPORTED_LISTENER } from "../voice/speech-listener";
import type { PromptSpeaker } from "../voice/prompt-speaker";

const cssFiles = import.meta.glob("../**/*.css", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("the header", () => {
  const html = renderToString(<Header />);
  it("has Text size, then the language button, both opening panels; no Home and no About (About is in the footer)", () => {
    expect(html).toContain(">Text size<");
    expect(html).not.toContain("About &amp; disclaimer");
    expect(html).not.toContain(">Home<");
    expect(html.indexOf(">Text size<")).toBeLessThan(html.indexOf("header__lang"));
    expect((html.match(/aria-expanded="false"/g) ?? []).length).toBe(2);
    expect((html.match(/aria-controls=/g) ?? []).length).toBe(2);
  });
  it("the footer has About & disclaimer as a big button over a closed panel with the full disclaimer", () => {
    const footer = renderToString(<Footer />);
    expect(footer).toMatch(/class="btn btn--secondary footer__about"[^>]*aria-expanded="false"/);
    expect(footer).toContain("About &amp; disclaimer");
    expect(footer).toMatch(/class="footer__panel"[^>]*hidden/);
  });
  it("the settings panel has no heading, so the page heading stays first", () => {
    const settings = renderToString(<SettingsProvider><SettingsPanel onClose={() => {}} /></SettingsProvider>);
    expect(settings).not.toMatch(/<h[1-6]/);
    expect(settings).toContain('role="group"');
  });

  it("holds the text size and voice settings in a closed panel", () => {
    expect(html).toMatch(/class="[^"]*header__panel"[^>]*hidden/);
    expect(html).toContain("Text size and voice");
  });
});

describe("the settings panel", () => {
  const html = renderToString(
    <SettingsProvider>
      <SettingsPanel onClose={() => {}} />
    </SettingsProvider>
  );

  it("offers three text sizes as big Aa choices, normal selected, as radio buttons", () => {
    expect((html.match(/name="text-size"/g) ?? []).length).toBe(TEXT_SIZES.length);
    for (const label of ["Normal", "Large", "Extra large"]) expect(html).toContain(label);
    expect(html).toMatch(/value="normal"[^>]*checked|checked[^>]*value="normal"/);
    expect((html.match(/>Aa</g) ?? []).length).toBe(TEXT_SIZES.length);
  });

  it("offers a slower voice On/Off switch, off at first, and says it is the same recording", () => {
    expect(html).toContain("Slower voice");
    expect(html).toContain("It is the same recording.");
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"/);
    expect(html).toMatch(/<span>Off<\/span>/);
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

  it("is always next to the play button, and nothing plays by itself", () => {
    const html = renderToString(
      <VoiceProvider speaker={speaker} listener={UNSUPPORTED_LISTENER}>
        <SpeakButton text="Hello." />
      </VoiceProvider>
    );
    expect(html).toContain("Play the question");
    expect(html).toContain("Play again");
    expect(html).not.toContain("Playing…");
  });
});
