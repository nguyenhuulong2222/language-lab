// @vitest-environment jsdom
/**
 * Bigger pictures and the full-screen view (federal picture, diagram, AI illustration): the
 * picture is a button with its label and visible hint; it opens a modal dialog with the same file,
 * the caption and the credit; Close, Esc, a tap on the backdrop and Back close it; focus comes back;
 * it leaves no extra history entry, also inside a section with its own Back handling.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { diagramAsPicture, DIAGRAMS } from "../../engine/diagrams";
import { ILLUSTRATIONS, illustrationUrl, type IllustrationEntry } from "../../engine/illustrations";
import { PICTURE_MANIFEST, pictureUrl, type PictureEntry } from "../../engine/question-images";
import { ENGLISH_MESSAGES as EN } from "../../i18n";
import { AppProviders } from "../AppProviders";
import { QuestionIllustration, QuestionPicture } from "../components/QuestionPicture";
import { PracticeApp } from "../PracticeApp";
import pictureCss from "../components/QuestionPicture.css?raw";

const federal: PictureEntry = PICTURE_MANIFEST.images[0]!;
const diagram: PictureEntry = diagramAsPicture(DIAGRAMS.images[0]!);
const illustration: IllustrationEntry = { ...(ILLUSTRATIONS.images.find((e) => e.source === "ai") ?? ILLUSTRATIONS.images[0]!), reviewed: true };

const CASES = [
  {
    name: "a federal picture",
    ui: () => <QuestionPicture picture={federal} />,
    src: pictureUrl(federal),
    alt: federal.alt,
    caption: federal.caption,
    credit: `(${federal.creator}, ${federal.date})`,
  },
  {
    name: "a diagram",
    ui: () => <QuestionPicture picture={diagram} />,
    src: pictureUrl(diagram),
    alt: diagram.alt,
    caption: diagram.caption,
    credit: `(${diagram.creator})`,
  },
  {
    name: "an AI illustration",
    ui: () => <QuestionIllustration illustration={illustration} />,
    src: illustrationUrl(illustration),
    alt: illustration.alt,
    caption: illustration.caption,
    credit: EN["illustration.label"],
  },
];

beforeEach(() => {
  // jsdom has no modal dialogs: the same behaviour as a browser, enough for these tests.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal("speechSynthesis", { cancel() {}, speak() {}, pause() {}, resume() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
  Element.prototype.scrollIntoView = () => {};
  vi.spyOn(console, "warn").mockImplementation(() => {});
  window.history.replaceState(null, "");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.classList.remove("ll-picture-open");
});

const opener = () => screen.getByRole("button", { name: EN["picture.zoom.label"] });
const dialog = () => document.querySelector<HTMLDialogElement>("dialog.picture-dialog")!;
const closeButton = () => dialog().querySelector<HTMLButtonElement>(".picture-dialog__close")!;
/** Wait for the popstate of a history.back() (it comes in a later task). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

describe.each(CASES)("$name", ({ ui, src, alt, caption, credit }) => {
  it("is a button with the label, a magnifier and the visible hint; the dialog is closed", () => {
    render(ui());
    const button = opener();
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.querySelector("img")!.getAttribute("src")).toBe(src);
    expect(button.querySelector(".question-picture__zoom svg")).not.toBeNull();
    expect(document.getElementById(button.getAttribute("aria-describedby")!)!.textContent).toContain(caption);
    expect(screen.getByText(EN["picture.zoom.hint"])).toBeTruthy();
    expect(dialog().open).toBe(false);
  });

  it("opens a dialog with the same file, the caption and the credit; Close is focused and the page is locked", () => {
    render(ui());
    fireEvent.click(opener());
    const d = dialog();
    expect(d.open).toBe(true);
    const img = d.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(src);
    expect(img.getAttribute("alt")).toBe(alt);
    expect(d.textContent).toContain(caption);
    expect(d.textContent).toContain(credit);
    expect(d.querySelectorAll(".btn--primary")).toHaveLength(1);
    expect(closeButton().textContent).toBe(EN["picture.zoom.close"]);
    expect(document.activeElement).toBe(closeButton());
    expect(document.documentElement.classList.contains("ll-picture-open")).toBe(true);
  });

  it("Close closes it, gives focus back to the picture and takes its history entry away", async () => {
    render(ui());
    const before = window.history.length;
    fireEvent.click(opener());
    expect(window.history.length).toBe(before + 1);
    expect(window.history.state).toMatchObject({ languageLabPicture: true });
    fireEvent.click(closeButton());
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(opener());
    expect(document.documentElement.classList.contains("ll-picture-open")).toBe(false);
    await settle();
    expect(window.history.state).toBeNull();
    // Opening again reuses that one entry: never more than one.
    fireEvent.click(opener());
    expect(window.history.length).toBe(before + 1);
  });

  it("Esc closes it (the browser's cancel, then close) and focus comes back", async () => {
    render(ui());
    fireEvent.click(opener());
    dialog().dispatchEvent(new Event("cancel"));
    dialog().close();
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(opener());
    await settle();
    expect(window.history.state).toBeNull();
  });

  it("a tap on the backdrop closes it; a tap on the picture does not", () => {
    render(ui());
    fireEvent.click(opener());
    fireEvent.click(dialog().querySelector("img")!);
    expect(dialog().open).toBe(true);
    fireEvent.click(dialog());
    expect(dialog().open).toBe(false);
  });

  it("Back closes it and leaves no entry behind", async () => {
    render(ui());
    fireEvent.click(opener());
    window.history.back();
    await waitFor(() => expect(dialog().open).toBe(false));
    expect(document.activeElement).toBe(opener());
    await settle();
    expect(window.history.state).toBeNull();
  });
});

describe("inside Study first (section history)", () => {
  it("Back closes the picture and stays in Study; the next Back goes Home", async () => {
    render(
      <AppProviders>
        <PracticeApp now={() => "2026-11-27T10:00:00.000Z"} seed={() => 7} />
      </AppProviders>
    );
    fireEvent.click(screen.getAllByRole("button", { name: (n) => n.startsWith(EN["home.study.title"]) }).at(-1)!);
    fireEvent.click((await screen.findAllByRole("button", { name: (n) => n.startsWith(EN["study.version.2008"]) })).at(-1)!);
    // Step to the first question with a picture.
    for (let i = 0; i < 40 && screen.queryAllByRole("button", { name: EN["picture.zoom.label"] }).length === 0; i++) {
      fireEvent.click((await screen.findAllByRole("button", { name: EN["civics.next"] })).at(-1)!);
    }
    const sectionLength = window.history.length;
    expect(window.history.state).toMatchObject({ languageLabSection: true });
    fireEvent.click(opener());
    expect(window.history.length).toBe(sectionLength + 1);
    window.history.back();
    await waitFor(() => expect(dialog().open).toBe(false));
    await settle();
    // Still in Study, on the section entry.
    expect(screen.queryAllByRole("button", { name: EN["civics.next"] }).length).toBeGreaterThan(0);
    expect(window.history.state).toMatchObject({ languageLabSection: true });
    expect(window.history.state).not.toHaveProperty("languageLabPicture");
    // Close by the button: the same, and still no extra entry.
    fireEvent.click(opener());
    fireEvent.click(closeButton());
    await settle();
    expect(window.history.length).toBe(sectionLength + 1);
    expect(screen.queryAllByRole("button", { name: EN["civics.next"] }).length).toBeGreaterThan(0);
    expect(window.history.state).toMatchObject({ languageLabSection: true });
    // The section's own Back still goes Home.
    window.history.back();
    await waitFor(() => expect(screen.queryAllByRole("button", { name: EN["civics.next"] })).toHaveLength(0));
  });
});

describe("styles", () => {
  it("fill the column, never block pinch-zoom, and use no inline style", () => {
    expect(pictureCss).toMatch(/\.question-picture \{[^}]*max-width: var\(--measure\)/);
    expect(pictureCss).toMatch(/\.question-picture__image \{[^}]*width: 100%;[^}]*height: auto;/);
    expect(pictureCss).not.toMatch(/touch-action/);
    expect(pictureCss).toMatch(/max-height: 85dvh/);
    render(<QuestionPicture picture={federal} />);
    expect(document.querySelector("[style]")).toBeNull();
  });
});
