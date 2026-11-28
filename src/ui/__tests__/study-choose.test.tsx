// @vitest-environment jsdom
/**
 * Study: pick any question (the question list with search, "Go to question number") and test
 * yourself on it ("Test myself": answers and picture hidden until Check, graded by the real civics
 * grader). The whole app with the real engine and data; nothing is fetched or stored.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { loadAnswerKey } from "../../engine/civics-answer-key";
import { designatedQuestionIds } from "../../engine/special-consideration";
import { ENGLISH_MESSAGES as EN } from "../../i18n";
import { AppProviders } from "../AppProviders";
import { PracticeApp } from "../PracticeApp";
import { findQuestions, questionIndexFor, searchable, studyQuestions } from "../screens/StudyScreen";

const static2008 = studyQuestions(loadAnswerKey("2008", { production: false }));
const static2025 = studyQuestions(loadAnswerKey("2025", { production: false }));
const designated2025 = designatedQuestionIds("2025");
const special2025 = static2025.filter((e) => designated2025.includes(e.id));

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  fetchSpy = vi.fn(async () => new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal("speechSynthesis", { cancel() {}, speak() {}, pause() {}, resume() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
  Element.prototype.scrollIntoView = () => {};
  vi.spyOn(console, "warn").mockImplementation(() => {});
  window.history.replaceState(null, "");
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.classList.remove("ll-picture-open");
});

const button = (text: string) => screen.getAllByRole("button", { name: (n) => n === text || n.startsWith(text) }).at(-1)!;
const findButton = async (text: string) => (await screen.findAllByRole("button", { name: (n) => n === text || n.startsWith(text) }, { timeout: 4000 })).at(-1)!;
const prompt = () => document.querySelector<HTMLElement>("main .prompt")!.textContent!.trim();
const count = () => document.querySelector("main .progress-line")!.textContent!.trim();
const list = () => document.querySelector<HTMLDialogElement>("dialog.study-list")!;
const rows = () => [...list().querySelectorAll<HTMLButtonElement>(".study-list__row")];
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
/** Filled buttons in the page, outside a closed dialog. */
const primaries = () => [...document.querySelectorAll(".btn--primary")].filter((el) => el.closest("dialog:not([open])") === null);

async function study(version: "2008" | "2025" = "2008", { special = false } = {}) {
  render(
    <AppProviders>
      <PracticeApp now={() => "2026-11-28T10:00:00.000Z"} seed={() => 7} />
    </AppProviders>
  );
  fireEvent.click(button(EN["home.study.title"]));
  if (special) fireEvent.click(await screen.findByLabelText(EN["study.special.label"]));
  fireEvent.click(await findButton(EN[version === "2008" ? "study.version.2008" : "study.version.2025"]));
  await findButton(EN["civics.next"]);
}

describe("helpers", () => {
  it("search is case and accent insensitive; numbers are whole numbers from 1 to N", () => {
    expect(searchable("  Constitución  ÉTAT ")).toBe("constitucion etat");
    expect(findQuestions(static2008, "SUPREME").map((r) => r.entry.id)).toContain("2008-001");
    expect(findQuestions(static2008, "cônstitutión").length).toBeGreaterThan(0);
    expect(findQuestions(static2008, "").length).toBe(static2008.length);
    expect(questionIndexFor("12", 90)).toBe(11);
    expect(questionIndexFor(" 1 ", 90)).toBe(0);
    for (const bad of ["0", "91", "-1", "1.5", "abc", "", "1e2"]) expect(questionIndexFor(bad, 90), bad).toBeNull();
  });
});

describe("the question list", () => {
  it("opens as a modal with one history entry, filters, jumps, and closes", async () => {
    await study("2008");
    const sectionLength = window.history.length;
    const opener = button(EN["study.list.open"]);
    fireEvent.click(opener);
    expect(list().open).toBe(true);
    expect(window.history.length).toBe(sectionLength + 1);
    expect(document.activeElement).toBe(list().querySelector(".study-list__close"));
    expect(list().querySelectorAll(".btn--primary")).toHaveLength(1);
    expect(rows()).toHaveLength(static2008.length);
    expect(rows()[0]!.textContent).toBe(`1. ${static2008[0]!.questionText}`);
    expect(rows()[0]!.querySelector('[lang="en"]')!.textContent).toBe(static2008[0]!.questionText);
    expect(rows()[0]!.getAttribute("aria-current")).toBe("true");
    // Search: case and accents do not matter.
    const search = within(list()).getByLabelText(EN["study.list.search"]);
    fireEvent.change(search, { target: { value: "SUPRÉME law" } });
    expect(rows().map((r) => r.textContent)).toEqual(findQuestions(static2008, "supreme law").map((r) => `${r.number}. ${r.entry.questionText}`));
    fireEvent.change(search, { target: { value: "zzzz" } });
    expect(rows()).toHaveLength(0);
    expect(within(list()).getByText(EN["study.list.none"])).toBeTruthy();
    // Jump to question 12: the list closes and the question is shown.
    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(rows()[11]!);
    expect(list().open).toBe(false);
    expect(prompt()).toBe(static2008[11]!.questionText);
    expect(count()).toBe(`Question 12 of ${static2008.length}`);
    await settle();
    expect(window.history.state).toMatchObject({ languageLabSection: true });
    expect(window.history.state).not.toHaveProperty("languageLabStudyList");
    // Next and Previous carry on from there.
    fireEvent.click(button(EN["civics.next"]));
    expect(prompt()).toBe(static2008[12]!.questionText);
    fireEvent.click(button(EN["study.prev"]));
    fireEvent.click(button(EN["study.prev"]));
    expect(prompt()).toBe(static2008[10]!.questionText);
  });

  it("Close, Esc and Back close it, focus returns, and no extra history entry is left", async () => {
    await study("2008");
    const sectionLength = window.history.length;
    const opener = button(EN["study.list.open"]);
    fireEvent.click(opener);
    fireEvent.click(list().querySelector(".study-list__close")!);
    expect(list().open).toBe(false);
    expect(document.activeElement).toBe(opener);
    await settle();
    fireEvent.click(opener);
    list().dispatchEvent(new Event("cancel"));
    list().close();
    expect(document.activeElement).toBe(opener);
    await settle();
    fireEvent.click(opener);
    window.history.back();
    await waitFor(() => expect(list().open).toBe(false));
    await settle();
    expect(document.activeElement).toBe(opener);
    expect(window.history.length).toBe(sectionLength + 1);
    expect(window.history.state).toMatchObject({ languageLabSection: true });
    expect(window.history.state).not.toHaveProperty("languageLabStudyList");
    // Still in Study; a tap on the backdrop also closes it.
    fireEvent.click(opener);
    fireEvent.click(list());
    expect(list().open).toBe(false);
    expect(count()).toBe(`Question 1 of ${static2008.length}`);
  });

  it("lists the questions of the chosen version, and only the 65/20 ones with that filter", async () => {
    await study("2025");
    fireEvent.click(button(EN["study.list.open"]));
    expect(rows()).toHaveLength(static2025.length);
    expect(rows().at(-1)!.textContent).toBe(`${static2025.length}. ${static2025.at(-1)!.questionText}`);
    cleanup();
    await study("2025", { special: true });
    fireEvent.click(button(EN["study.list.open"]));
    expect(rows().map((r) => r.querySelector('[lang="en"]')!.textContent)).toEqual(special2025.map((e) => e.questionText));
    // The questions whose answers change stay out, as before.
    expect(special2025.every((e) => e.answerType === "static")).toBe(true);
  });
});

describe("Go to question number", () => {
  it("goes to a valid number and explains an invalid one", async () => {
    await study("2008");
    const box = screen.getByLabelText(EN["study.go.label"]) as HTMLInputElement;
    expect(box.getAttribute("inputmode")).toBe("numeric");
    fireEvent.change(box, { target: { value: "12" } });
    fireEvent.click(button(EN["study.go.submit"]));
    expect(prompt()).toBe(static2008[11]!.questionText);
    expect(count()).toBe(`Question 12 of ${static2008.length}`);
    for (const bad of ["0", String(static2008.length + 1), "abc"]) {
      fireEvent.change(box, { target: { value: bad } });
      fireEvent.submit(box.closest("form")!);
      expect(screen.getByText(EN["study.go.invalid"].replace("{total}", String(static2008.length)), { exact: false })).toBeTruthy();
      expect(box.getAttribute("aria-invalid")).toBe("true");
      expect(prompt()).toBe(static2008[11]!.questionText);
    }
    fireEvent.change(box, { target: { value: String(static2008.length) } });
    fireEvent.click(button(EN["study.go.submit"]));
    expect(prompt()).toBe(static2008.at(-1)!.questionText);
    expect(box.getAttribute("aria-invalid")).toBe("false");
  });
});

describe("Test myself", () => {
  it("hides the answers and the picture until Check; Correct shows them; Try again hides them again", async () => {
    await study("2008");
    expect((screen.getByLabelText(EN["study.mode.see"]) as HTMLInputElement).checked).toBe(true);
    // "See the answers": as before.
    expect(document.querySelector("main .answer-list")).not.toBeNull();
    expect(document.querySelector("main .question-picture")).not.toBeNull();
    expect(primaries()).toHaveLength(1);
    fireEvent.click(screen.getByLabelText(EN["study.mode.test"]));
    expect(prompt()).toBe(static2008[0]!.questionText);
    expect(document.querySelector("main .answer-list")).toBeNull();
    expect(document.querySelector("main .question-picture")).toBeNull();
    expect(primaries().map((b) => b.textContent)).toEqual([EN["study.check"]]);
    fireEvent.change(document.querySelector("textarea")!, { target: { value: "the Constitution" } });
    fireEvent.click(button(EN["study.check"]));
    expect(await screen.findByRole("heading", { name: EN["civics.correct"] })).toBeTruthy();
    expect(document.querySelector("main .panel--correct svg")).not.toBeNull();
    expect(document.querySelector("main .answer-list")!.textContent).toContain("the Constitution");
    expect(document.querySelector("main .question-picture")).not.toBeNull();
    expect(primaries().map((b) => b.textContent)).toEqual([EN["civics.next"]]);
    fireEvent.click(button(EN["study.tryAgain"]));
    expect(document.querySelector("main .answer-list")).toBeNull();
    expect(document.querySelector("main .question-picture")).toBeNull();
    expect(document.querySelector("textarea")!.value).toBe("");
  });

  it("an incorrect answer is Not yet, with the official answers", async () => {
    await study("2008");
    fireEvent.click(screen.getByLabelText(EN["study.mode.test"]));
    fireEvent.change(document.querySelector("textarea")!, { target: { value: "the Bill of Rights" } });
    fireEvent.click(button(EN["study.check"]));
    expect(await screen.findByRole("heading", { name: EN["civics.notYet"] })).toBeTruthy();
    expect(document.querySelector("main .panel--wrong svg")).not.toBeNull();
    expect(document.querySelector("main .answer-list")).not.toBeNull();
    // Next: a new question, hidden answers again.
    fireEvent.click(button(EN["civics.next"]));
    expect(prompt()).toBe(static2008[1]!.questionText);
    expect(document.querySelector("main .answer-list")).toBeNull();
  });

  it("switching the mode keeps the question; nothing is fetched or stored", async () => {
    await study("2008");
    const fetchesBefore = fetchSpy.mock.calls.length;
    const box = screen.getByLabelText(EN["study.go.label"]);
    fireEvent.change(box, { target: { value: "20" } });
    fireEvent.click(button(EN["study.go.submit"]));
    fireEvent.click(screen.getByLabelText(EN["study.mode.test"]));
    expect(prompt()).toBe(static2008[19]!.questionText);
    fireEvent.change(document.querySelector("textarea")!, { target: { value: "anything" } });
    fireEvent.click(button(EN["study.check"]));
    await screen.findByRole("heading", { name: (n) => n === EN["civics.correct"] || n === EN["civics.notYet"] });
    fireEvent.click(screen.getByLabelText(EN["study.mode.see"]));
    expect(prompt()).toBe(static2008[19]!.questionText);
    expect(document.querySelector("main .result-headline")).toBeNull();
    expect(fetchSpy.mock.calls.length).toBe(fetchesBefore);
    expect(localStorage.length + sessionStorage.length).toBe(0);
    // No score or count anywhere.
    expect(document.body.textContent).not.toMatch(/\d+ (of|out of) \d+ correct/i);
  });
});
