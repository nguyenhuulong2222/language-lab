// @vitest-environment jsdom
/**
 * Interaction tests (spec release-finish REQ-T01, REQ-T02; audit COR-01). The whole app is rendered
 * in a DOM with the real providers, engine and data, and driven by clicks and typing. Nothing is
 * sent: `fetch` is a spy, and the only test that lets the AI coach call it answers with a stub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AppProviders } from "../AppProviders";
import { PracticeApp } from "../PracticeApp";
import { ENGLISH_MESSAGES as EN } from "../../i18n";

const AT = "2026-11-20T10:00:00.000Z";
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // A browser with a device voice and no network: the screens behave as they do on a phone.
  fetchSpy = vi.fn(async () => new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", fetchSpy);
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
  delete document.documentElement.dataset["textSize"];
});

function app() {
  return render(
    <AppProviders>
      <PracticeApp now={() => AT} seed={() => 7} />
    </AppProviders>
  );
}
/** A button by its visible text (exact, or starting with it, as option cards have a second line). */
const button = (text: string) => screen.getByRole("button", { name: (name) => name === text || name.startsWith(text) });
const findButton = (text: string) => screen.findByRole("button", { name: (name) => name === text || name.startsWith(text) }, { timeout: 4000 });
const has = (text: string) => screen.queryAllByRole("button", { name: (name) => name === text || name.startsWith(text) }).length > 0;
const typeAnswer = (value: string) => fireEvent.change(screen.getByRole("textbox"), { target: { value } });
const prompt = () => document.querySelector<HTMLElement>(".prompt")!.textContent!.trim();

async function startSetup(cardText: string, { profile = false, filed }: { profile?: boolean; filed?: "before" | "on_or_after" } = {}) {
  fireEvent.click(button(cardText));
  if (profile) fireEvent.click(document.querySelector<HTMLInputElement>('input[name="profile"]')!);
  if (filed) fireEvent.click(document.querySelector<HTMLInputElement>(`input[name="filed"][value="${filed}"]`)!);
}

describe("the AI coach from the home card (REQ-C18, REQ-C19)", () => {
  it("home card → notice; Cancel → the choice; No → the first question; nothing is fetched", async () => {
    app();
    await startSetup(EN["home.coach.title"], { profile: true });
    fireEvent.click(button(EN["intro.start"]));
    expect(await screen.findByText(EN["coach.notice.title"])).toBeTruthy();
    expect(has(EN["coach.notice.confirm"])).toBe(true);
    fireEvent.click(button(EN["coach.notice.cancel"]));
    expect(await screen.findByText(EN["coach.choice.title"])).toBeTruthy();
    // Focus goes back to "Use the AI coach".
    await waitFor(() => expect((document.activeElement as HTMLElement | null)?.textContent).toContain(EN["coach.choice.use"]));
    fireEvent.click(button(EN["coach.choice.no"]));
    expect(await findButton(EN["n400.save"])).toBeTruthy();
    typeAnswer("My name is Aurora Thistlewood.");
    fireEvent.click(button(EN["n400.save"]));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("no fetch before consent; after Confirm the next answer is sent once", async () => {
    fetchSpy.mockImplementation(async () =>
      new Response(JSON.stringify({ status: "ok", reply: { followUp: "Have you used any other names?", feedback: "understood", tip: "Good, a full sentence." } }), { status: 200 })
    );
    app();
    await startSetup(EN["home.coach.title"], { profile: true });
    fireEvent.click(button(EN["intro.start"]));
    await screen.findByText(EN["coach.notice.title"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fireEvent.click(button(EN["coach.notice.confirm"]));
    await findButton(EN["n400.save"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    typeAnswer("My name is Aurora Thistlewood.");
    fireEvent.click(button(EN["n400.save"]));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(String(fetchSpy.mock.calls[0]![0])).toBe("/api/coach");
    expect(await screen.findByText("Good, a full sentence.")).toBeTruthy();
  });
});

describe("the full interview to the report (typed answers)", () => {
  it("N-400, reading, writing and civics, then the report with its disclaimer", async () => {
    app();
    await startSetup(EN["home.full.title"], { profile: true, filed: "before" });
    fireEvent.click(button(EN["intro.start"]));
    fireEvent.click(await findButton(EN["coach.choice.no"]));
    // N-400: answer every question.
    for (let guard = 0; guard < 30 && !has(EN["n400.done.next"]); guard++) {
      await findButton(EN["n400.save"]);
      typeAnswer("My answer is short.");
      fireEvent.click(button(EN["n400.save"]));
      await waitFor(() => expect(has(EN["n400.save"]) || has(EN["n400.done.next"])).toBe(true));
    }
    fireEvent.click(button(EN["n400.done.next"]));
    // Reading: read the sentence shown.
    await findButton(EN["reading.submit"]);
    typeAnswer(prompt());
    fireEvent.click(button(EN["reading.submit"]));
    fireEvent.click(await findButton(EN["reading.toWriting"]));
    // Writing: three wrong attempts.
    for (let guard = 0; guard < 5 && !has(EN["writing.toCivics"]); guard++) {
      await findButton(EN["writing.submit"]);
      typeAnswer("zzz qqq");
      fireEvent.click(button(EN["writing.submit"]));
      await waitFor(() => expect(has(EN["writing.next"]) || has(EN["writing.toCivics"])).toBe(true));
      if (has(EN["writing.next"])) fireEvent.click(button(EN["writing.next"]));
    }
    fireEvent.click(button(EN["writing.toCivics"]));
    // Civics (2008): wrong answers until the practice test stops.
    for (let guard = 0; guard < 12 && !has(EN["civics.finish"]); guard++) {
      await findButton(EN["civics.submit"]);
      typeAnswer("zzz");
      fireEvent.click(button(EN["civics.submit"]));
      await waitFor(() => expect(has(EN["civics.next"]) || has(EN["civics.finish"])).toBe(true));
      if (has(EN["civics.next"])) fireEvent.click(button(EN["civics.next"]));
    }
    fireEvent.click(button(EN["civics.finish"]));
    expect(await findButton(EN["report.again"])).toBeTruthy();
    expect(document.body.textContent).toContain(EN["report.line.reading.done"].replace("{n}", "1"));
    expect(document.body.textContent).toContain("2008");
    expect(document.body.textContent).toContain("This is a practice tool only.");
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);
});

describe("reading and writing", () => {
  it("reading: a near miss (a plural) still counts", async () => {
    app();
    fireEvent.click(button(EN["home.part.reading.title"]));
    await findButton(EN["reading.submit"]);
    const words = prompt().replace(/[.?!,]/g, "").split(/\s+/);
    // Change one longer word by its plural ending: "citizens" -> "citizen", "vote" -> "votes".
    const i = words.findIndex((w) => w.length >= 4 && /^[a-z]+$/i.test(w) && !/ss$/i.test(w));
    words[i] = /s$/i.test(words[i]!) ? words[i]!.slice(0, -1) : `${words[i]}s`;
    typeAnswer(words.join(" "));
    fireEvent.click(button(EN["reading.submit"]));
    expect(await screen.findByText(EN["compare.counts"], { exact: false })).toBeTruthy();
    expect(document.body.textContent).toContain("This still counts.");
  });
  it("writing: \"Show the sentence\" shows it, and the attempt is marked as assisted", async () => {
    app();
    fireEvent.click(button(EN["home.part.writing.title"]));
    fireEvent.click(await findButton(EN["writing.show"]));
    expect(await screen.findByText(EN["writing.shown"])).toBeTruthy();
    typeAnswer(prompt());
    fireEvent.click(button(EN["writing.submit"]));
    expect(await screen.findByText(EN["compare.counts"], { exact: false })).toBeTruthy();
    fireEvent.click(await findButton(EN["report.see"]));
    expect(await findButton(EN["report.home"])).toBeTruthy();
    expect(document.body.textContent?.toLowerCase()).toContain("assisted");
  });
});

describe("Study first and 65/20", () => {
  it("Study first pages forward and back", async () => {
    app();
    fireEvent.click(button(EN["home.study.title"]));
    fireEvent.click(await findButton(EN["study.version.2008"]));
    await screen.findByText(/^Question 1 of \d+$/);
    const first = prompt();
    fireEvent.click(button(EN["civics.next"]));
    await waitFor(() => expect(prompt()).not.toBe(first));
    expect(document.body.textContent).toContain("Question 2 of");
    fireEvent.click(button(EN["study.prev"]));
    await waitFor(() => expect(prompt()).toBe(first));
  });
  it("Study first with only the 65/20 questions", async () => {
    app();
    fireEvent.click(button(EN["home.study.title"]));
    fireEvent.click(await screen.findByLabelText(EN["study.special.label"]));
    fireEvent.click(button(EN["study.version.2025"]));
    expect(await screen.findByText("Question 1 of 16")).toBeTruthy();
    expect(document.body.textContent).toContain("4 of the 20 questions have answers that change");
  });
  it("65/20 setup: the home card ticks the choice; the civics part asks 10 questions", async () => {
    app();
    fireEvent.click(button(EN["home.special.title"]));
    const box = screen.getByLabelText<HTMLInputElement>(EN["intro.special.label"]);
    expect(box.checked).toBe(true);
    expect(document.body.textContent).toContain("asks 10 of the 20 questions marked with a star (*)");
    const link = screen.getByRole("link", { name: EN["special.language.link"] });
    expect(link.getAttribute("href")).toBe("https://www.uscis.gov/citizenship/exceptions-and-accommodations");
    fireEvent.click(document.querySelector<HTMLInputElement>('input[name="filed"][value="on_or_after"]')!);
    fireEvent.click(button(EN["intro.start"]));
    expect(await screen.findByText("Question 1 of 10")).toBeTruthy();
  });
  it("65/20 can be unticked: then the normal 2025 test (20 questions) runs", async () => {
    app();
    fireEvent.click(button(EN["home.special.title"]));
    fireEvent.click(screen.getByLabelText(EN["intro.special.label"]));
    fireEvent.click(document.querySelector<HTMLInputElement>('input[name="filed"][value="on_or_after"]')!);
    fireEvent.click(button(EN["intro.start"]));
    expect(await screen.findByText("Question 1 of 20")).toBeTruthy();
  });
});

describe("header settings", () => {
  it("the language menu switches the interface; questions stay English", async () => {
    app();
    fireEvent.click(document.querySelector<HTMLButtonElement>(".header__lang")!);
    fireEvent.click(document.querySelector<HTMLButtonElement>('.language-menu__option[lang="vi"]')!);
    await waitFor(() => expect(document.documentElement.lang).toBe("vi"));
    expect(document.body.textContent).toContain("Luyện kiến thức công dân 65/20");
    fireEvent.click(screen.getByRole("button", { name: (n) => n.startsWith("Đọc") }));
    await waitFor(() => expect(document.querySelector(".prompt")).not.toBeNull());
    expect(document.querySelector(".prompt")!.getAttribute("lang")).toBe("en");
  });
  it("text size: Extra large sets the root size and Normal sets it back", async () => {
    app();
    fireEvent.click(button(EN["header.settings"]));
    const dialog = document.querySelector<HTMLElement>(".settings, [role='dialog'], #settings") ?? document.body;
    fireEvent.click(within(dialog).getByLabelText(EN["settings.textSize.extraLarge"]));
    await waitFor(() => expect(document.documentElement.dataset["textSize"]).toBe("extra-large"));
    fireEvent.click(within(dialog).getByLabelText(EN["settings.textSize.normal"]));
    await waitFor(() => expect(document.documentElement.dataset["textSize"]).toBe("normal"));
  });
});
