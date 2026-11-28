// @vitest-environment jsdom
/**
 * QA Q4: no English interface sentence inside a Vietnamese screen. Every screen of the app is
 * rendered in Vietnamese; text inside lang="en" (legal lines until reviewed, the English copy of the
 * AI notice, and the practice content: questions and sentences) is set aside, and no other text may
 * be the English text of a non-legal key that has a Vietnamese translation.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppProviders } from "../AppProviders";
import { PracticeApp } from "../PracticeApp";
import { CATALOGS, ENGLISH_MESSAGES as EN, isLegalKey, loadLocale } from "../../i18n";

const AT = "2026-11-17T10:00:00.000Z";
let VI: Record<string, string>;
let ENGLISH_UI: Set<string>;
beforeAll(async () => {
  await loadLocale("vi");
  VI = CATALOGS.vi as Record<string, string>;
  // A word that the Vietnamese file itself uses (such as the short step name "Civics") is allowed.
  const viTexts = new Set(Object.values(VI));
  ENGLISH_UI = new Set(
    Object.entries(EN)
      .filter(([key, text]) => !isLegalKey(key) && VI[key] !== undefined && VI[key] !== text && !text.includes("{") && text.length >= 4)
      .map(([, text]) => text)
      .filter((text) => !viTexts.has(text))
  );
});
beforeEach(() => {
  // jsdom has no modal dialogs (the Study question list, the full-screen picture).
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
  vi.stubGlobal("speechSynthesis", { cancel() {}, speak() {}, pause() {}, resume() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  Element.prototype.scrollIntoView = () => {};
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function app() {
  return render(
    <AppProviders initialLanguage="vi">
      <PracticeApp now={() => AT} seed={() => 7} />
    </AppProviders>
  );
}
const buttons = (text: string) => screen.getAllByRole("button", { name: (n) => n === text || n.startsWith(text) });
const button = (text: string) => buttons(text).at(-1)!;
const find = async (text: string) => (await screen.findAllByRole("button", { name: (n) => n === text || n.startsWith(text) }, { timeout: 4000 })).at(-1)!;
const typeAnswer = (value: string) => fireEvent.change(screen.getByRole("textbox"), { target: { value } });

/** English UI lines on the page, outside lang="en". */
function englishLines(): string[] {
  const copy = document.body.cloneNode(true) as HTMLElement;
  for (const el of copy.querySelectorAll('[lang="en"], [hidden], script, style')) el.remove();
  const found: string[] = [];
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (ENGLISH_UI.has(text)) found.push(text);
    const whole = (node.parentElement?.textContent ?? "").replace(/\s+/g, " ").trim();
    if (whole !== text && ENGLISH_UI.has(whole)) found.push(whole);
  }
  return [...new Set(found)];
}
const checked: string[] = [];
function expectVietnamese(name: string) {
  checked.push(name);
  expect(document.documentElement.lang, name).toBe("vi");
  expect(englishLines(), name).toEqual([]);
}
async function leave() {
  const back = document.querySelector<HTMLButtonElement>("main .back-home__button")!;
  if (back.getAttribute("aria-expanded") !== "true") fireEvent.click(back);
  const yes = screen.queryAllByRole("button", { name: VI["header.homeConfirm.yes"] });
  if (yes.length > 0) fireEvent.click(yes.at(-1)!);
  await waitFor(() => expect(document.getElementById("home-language")).not.toBeNull());
}

describe("every screen in Vietnamese has no English interface line (Q4)", () => {
  it("Home, the header panels, Study, setup, the coach choice and notice, N-400, reading, writing, civics and the reports", async () => {
    app();
    await waitFor(() => expect(document.querySelector("main h1")!.textContent).toBe(VI["home.title"]));
    expectVietnamese("home");
    fireEvent.click(button(VI["header.settings"]));
    expectVietnamese("text size panel");
    fireEvent.click(button(VI["settings.close"]));
    fireEvent.click(document.querySelector<HTMLButtonElement>(".footer__about")!);
    expectVietnamese("about panel");
    fireEvent.click(document.querySelector<HTMLButtonElement>(".footer__about")!);
    fireEvent.click(document.querySelector<HTMLInputElement>('input[name="who"][value="65/20"]')!);
    expectVietnamese("home 65/20");
    fireEvent.click(document.querySelector<HTMLInputElement>('input[name="who"][value="none"]')!);

    // Study
    fireEvent.click(button(VI["home.study.title"]));
    expectVietnamese("study choose");
    fireEvent.click(await find(VI["study.version.2025"]));
    await find(VI["civics.next"]);
    expectVietnamese("study question");
    // The question list (open, then filtered to nothing), "Go to question number" with a wrong number.
    fireEvent.click(button(VI["study.list.open"]));
    expectVietnamese("study question list");
    fireEvent.change(screen.getByLabelText(VI["study.list.search"]), { target: { value: "zzzz" } });
    expectVietnamese("study question list, no match");
    fireEvent.click(document.querySelector<HTMLButtonElement>("dialog.study-list .study-list__close")!);
    fireEvent.change(screen.getByLabelText(VI["study.go.label"]), { target: { value: "0" } });
    fireEvent.click(button(VI["study.go.submit"]));
    expectVietnamese("study go to a wrong number");
    // Test myself: before and after Check.
    fireEvent.click(screen.getByLabelText(VI["study.mode.test"]));
    expectVietnamese("study test myself");
    fireEvent.change(document.querySelector("textarea")!, { target: { value: "wrong words here" } });
    fireEvent.click(button(VI["study.check"]));
    await screen.findByRole("heading", { name: VI["civics.notYet"] });
    expectVietnamese("study test myself, checked");
    fireEvent.click(screen.getByLabelText(VI["study.mode.see"]));
    await leave();

    // Practice test: setup, the coach choice and notice, an N-400 question and the summary
    fireEvent.click(button(VI["home.full.title"]));
    expectVietnamese("setup");
    fireEvent.click(document.querySelector<HTMLInputElement>('input[name="profile"]')!);
    fireEvent.click(document.querySelector<HTMLInputElement>('input[name="filed"][value="on_or_after"]')!);
    fireEvent.click(button(VI["intro.start"]));
    await find(VI["coach.choice.no"]);
    expectVietnamese("coach choice");
    fireEvent.click(button(VI["coach.choice.use"]));
    await find(VI["coach.notice.cancel"]);
    expectVietnamese("coach notice");
    fireEvent.click(button(VI["coach.notice.cancel"]));
    fireEvent.click(await find(VI["coach.choice.no"]));
    await find(VI["n400.save"]);
    expectVietnamese("n400 question");
    fireEvent.click(document.querySelector<HTMLButtonElement>("main .back-home__button")!);
    expectVietnamese("leave question");
    await leave();

    // Reading and writing parts, with their results and part reports
    for (const part of ["reading", "writing"] as const) {
      fireEvent.click(button(VI[`home.part.${part}.title`]));
      await find(VI[`${part}.submit`]);
      expectVietnamese(`${part} question`);
      typeAnswer("wrong words here");
      fireEvent.click(button(VI[`${part}.submit`]));
      await screen.findAllByText(VI["compare.notYet"], { exact: false });
      expectVietnamese(`${part} result`);
      for (let guard = 0; guard < 6 && screen.queryAllByRole("button", { name: VI["report.see"] }).length === 0; guard++) {
        fireEvent.click(await find(VI[`${part}.next`]));
        typeAnswer("wrong words here");
        fireEvent.click(button(VI[`${part}.submit`]));
      }
      fireEvent.click(await find(VI["report.see"]));
      expectVietnamese(`${part} report`);
      await leave();
    }

    // Civics part, a result and the part report
    fireEvent.click(button(VI["home.part.civics.title"]));
    fireEvent.click(document.querySelector<HTMLInputElement>('input[name="filed"][value="on_or_after"]')!);
    fireEvent.click(button(VI["intro.start"]));
    await find(VI["civics.submit"]);
    expectVietnamese("civics question");
    typeAnswer("zzz");
    fireEvent.click(button(VI["civics.submit"]));
    await find(VI["civics.next"]);
    expectVietnamese("civics result");
    await leave();

    expect(checked.length).toBe(24);
  }, 60000);
});
