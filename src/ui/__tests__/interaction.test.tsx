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
// The last match: "Back to home" is both the bar at the top and the report's own button; the page's is last.
const button = (text: string) => screen.getAllByRole("button", { name: (name) => name === text || name.startsWith(text) }).at(-1)!;
const findButton = async (text: string) =>
  (await screen.findAllByRole("button", { name: (name) => name === text || name.startsWith(text) }, { timeout: 4000 })).at(-1)!;
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
    expect(document.body.textContent).toContain(EN["partReport.assisted"]);
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
  it("65/20 setup: choosing 65/20 on Home ticks the choice; the civics part asks 10 questions", async () => {
    app();
    fireEvent.click(document.querySelector<HTMLInputElement>('input[name="who"][value="special"]')!);
    fireEvent.click(button(EN["home.part.civics.title"]));
    const box = screen.getByLabelText<HTMLInputElement>(EN["intro.special.label"]);
    expect(box.checked).toBe(true);
    expect(document.body.textContent).toContain("asks 10 of the 20 questions marked with a star (*)");
    const link = screen.getByRole("link", { name: (n) => n.startsWith(EN["special.language.link"]) && n.includes(EN["common.newTab"]) });
    expect(link.getAttribute("href")).toBe("https://www.uscis.gov/citizenship/exceptions-and-accommodations");
    fireEvent.click(document.querySelector<HTMLInputElement>('input[name="filed"][value="on_or_after"]')!);
    fireEvent.click(button(EN["intro.start"]));
    expect(await screen.findByText("Question 1 of 10")).toBeTruthy();
  });
  it("65/20 full interview: N-400, then civics (no reading or writing), and the report says why", async () => {
    app();
    await startSetup(EN["home.full.title"], { profile: true, filed: "on_or_after" });
    fireEvent.click(screen.getByLabelText(EN["intro.special.label"]));
    fireEvent.click(button(EN["intro.start"]));
    fireEvent.click(await findButton(EN["coach.choice.no"]));
    // The stepper has no reading or writing step.
    const nav = [...document.querySelectorAll("nav")].map((n) => n.textContent ?? "").join(" ");
    expect(nav).toContain(EN["stage.civics.short"]);
    expect(nav).not.toContain(EN["stage.reading.short"]);
    for (let guard = 0; guard < 30 && !has(EN["writing.toCivics"]); guard++) {
      await findButton(EN["n400.save"]);
      typeAnswer("My answer is short.");
      fireEvent.click(button(EN["n400.save"]));
      await waitFor(() => expect(has(EN["n400.save"]) || has(EN["writing.toCivics"])).toBe(true));
    }
    expect(has(EN["n400.done.next"])).toBe(false);
    fireEvent.click(button(EN["writing.toCivics"]));
    expect(await screen.findByText("Question 1 of 10")).toBeTruthy();
    expect(document.body.textContent).toContain("you are exempt from the English requirement");
    for (let guard = 0; guard < 12 && !has(EN["civics.finish"]); guard++) {
      await findButton(EN["civics.submit"]);
      typeAnswer("zzz");
      fireEvent.click(button(EN["civics.submit"]));
      await waitFor(() => expect(has(EN["civics.next"]) || has(EN["civics.finish"])).toBe(true));
      if (has(EN["civics.next"])) fireEvent.click(button(EN["civics.next"]));
    }
    fireEvent.click(button(EN["civics.finish"]));
    expect(await findButton(EN["report.again"])).toBeTruthy();
    expect(document.body.textContent).not.toContain("Reading sentences read correctly");
    expect(document.body.textContent).toContain("If you are 65 or older with at least 20 years (65/20), you are also exempt from English");
  }, 30000);
  it("65/20 can be unticked: then the normal 2025 test (20 questions) runs", async () => {
    app();
    fireEvent.click(document.querySelector<HTMLInputElement>('input[name="who"][value="special"]')!);
    fireEvent.click(button(EN["home.part.civics.title"]));
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
    // Home: "2. What do you want to do?" in Vietnamese.
    expect(document.body.textContent).toContain("2. Bạn muốn làm gì?");
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
  it("slower voice: the switch says Off, then On after a tap", () => {
    app();
    fireEvent.click(button(EN["header.settings"]));
    const toggle = screen.getByRole("switch", { name: EN["settings.slow.label"] });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.textContent).toContain(EN["settings.slow.off"]);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(toggle.textContent).toContain(EN["settings.slow.on"]);
  });
  it("the first Home says where Text size is, in the page (no pop-up)", () => {
    app();
    expect(document.body.textContent).toContain(EN["home.textSizeHint"]);
    expect(document.querySelector("[role='dialog']")).toBeNull();
  });
});
describe("the language grid on Home", () => {
  const grid = () => document.getElementById("home-language")!;
  it("is open at the top of Home, above the welcome, with the current language marked and the review line", () => {
    app();
    expect(grid()).not.toBeNull();
    expect(grid().compareDocumentPosition(document.querySelector("main h1")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(grid()).getByText(EN["lang.menu.title"])).toBeTruthy();
    const current = grid().querySelector<HTMLElement>('.language-menu__option[aria-current="true"]')!;
    expect(current.getAttribute("lang")).toBe("en");
    expect(current.textContent).toContain(EN["lang.selected"]);
    expect(current.querySelector("svg")).not.toBeNull();
    expect(grid().querySelectorAll(".language-menu__option").length).toBeGreaterThan(1);
  });
  it("the header language button on Home goes to the grid and focuses the current language (no second copy)", () => {
    app();
    const headerButton = document.querySelector<HTMLButtonElement>(".header__lang")!;
    expect(headerButton.hasAttribute("aria-expanded")).toBe(false);
    fireEvent.click(headerButton);
    expect(document.activeElement).toBe(grid().querySelector('.language-menu__option[aria-current="true"]'));
  });
  it("choosing a language keeps focus on that button and says its name politely", async () => {
    app();
    const vi = grid().querySelector<HTMLButtonElement>('.language-menu__option[lang="vi"]')!;
    vi.focus();
    fireEvent.click(vi);
    await waitFor(() => expect(document.documentElement.lang).toBe("vi"));
    expect(document.activeElement).toBe(vi);
    const live = grid().querySelector('[role="status"]')!;
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("Tiếng Việt");
    expect(vi.getAttribute("aria-current")).toBe("true");
  });
});
describe("the whole interface follows the language (L3)", () => {
  it("Home in English, choose Tiếng Việt: welcome, Who/What, Text size and the AI notice are Vietnamese, legal lines stay English; English brings everything back", async () => {
    const VI = (await import("../../i18n/locales/vi.json")).default as unknown as Record<string, string>;
    app();
    const grid = document.getElementById("home-language")!;
    const h1 = () => document.querySelector("main h1")!.textContent!.trim();
    const headerText = () => document.querySelector("header")!.textContent!;
    expect(h1()).toBe(EN["home.title"]);
    fireEvent.click(grid.querySelector<HTMLButtonElement>('.language-menu__option[lang="vi"]')!);
    await waitFor(() => expect(h1()).toBe(VI["home.title"]));
    expect(document.documentElement.lang).toBe("vi");
    const body = document.body.textContent!;
    expect(body).toContain(VI["home.what.title"]);
    expect(body).toContain(VI["home.who.special.title"]);
    expect(screen.getByRole("button", { name: VI["home.full.title"] })).toBeTruthy();
    expect(headerText()).toContain(VI["header.settings"]);
    expect(document.querySelector(".ai-notice")!.textContent).toContain(VI["aiNotice.text"]);
    // Legal lines stay English until a person reviews the translation.
    expect(body).toContain(EN["disclaimer.full"]);
    expect(body).toContain(EN["home.special.text"]);
    fireEvent.click(grid.querySelector<HTMLButtonElement>('.language-menu__option[lang="en"]')!);
    await waitFor(() => expect(h1()).toBe(EN["home.title"]));
    expect(document.documentElement.lang).toBe("en");
    expect(document.body.textContent).toContain(EN["home.what.title"]);
    expect(headerText()).toContain(EN["header.settings"]);
    expect(document.querySelector(".ai-notice")).toBeNull();
  });
  it("starts in Vietnamese on a phone set to vi-VN, en-US", async () => {
    const VI = (await import("../../i18n/locales/vi.json")).default as unknown as Record<string, string>;
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["vi-VN", "en-US"]);
    app();
    await waitFor(() => expect(document.querySelector("main h1")!.textContent!.trim()).toBe(VI["home.title"]));
    expect(document.documentElement.lang).toBe("vi");
    expect(document.getElementById("home-language")!.querySelector('[aria-current="true"]')!.getAttribute("lang")).toBe("vi");
  });
  it("starts in English on a phone set to a language that is not offered (fr-FR)", async () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["fr-FR"]);
    app();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.querySelector("main h1")!.textContent!.trim()).toBe(EN["home.title"]);
    expect(document.documentElement.lang).toBe("en");
  });
});
describe("Back to Home and the browser Back button (Q1)", () => {
  // history.back() is asynchronous: let the one from the previous test arrive first.
  beforeEach(() => new Promise((resolve) => setTimeout(resolve, 60)));
  const backBar = () => document.querySelector<HTMLButtonElement>("main .back-home__button");
  const onHome = () => document.getElementById("home-language") !== null;
  async function toReadingReport() {
    fireEvent.click(button(EN["home.part.reading.title"]));
    for (let guard = 0; guard < 6; guard++) {
      await findButton(EN["reading.submit"]);
      typeAnswer("wrong words here");
      fireEvent.click(button(EN["reading.submit"]));
      if (has(EN["report.see"])) break;
      fireEvent.click(await findButton(EN["reading.next"]));
    }
    fireEvent.click(await findButton(EN["report.see"]));
    await findButton(EN["report.home"]);
  }
  it("Home has none; setup, a practice, Study and a report each start with Back to Home", async () => {
    app();
    expect(backBar()).toBeNull();
    fireEvent.click(button(EN["home.study.title"]));
    expect(backBar()!.textContent).toContain(EN["report.home"]);
    fireEvent.click(backBar()!);
    await waitFor(() => expect(onHome()).toBe(true));
    await startSetup(EN["home.full.title"]);
    expect(backBar()).not.toBeNull();
    fireEvent.click(backBar()!);
    await waitFor(() => expect(onHome()).toBe(true));
    await toReadingReport();
    expect(backBar()).not.toBeNull();
    expect(backBar()!.closest("main")!.firstElementChild!.contains(backBar())).toBe(true);
  });
  it("in a practice, Back to Home asks first: Keep practicing stays, Leave goes home", async () => {
    app();
    fireEvent.click(button(EN["home.part.reading.title"]));
    await findButton(EN["reading.submit"]);
    fireEvent.click(backBar()!);
    expect(backBar()!.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(EN["header.homeConfirm"])).toBeTruthy();
    // The question is the only thing shown: one main button.
    expect(document.querySelectorAll("main .btn--primary:not([hidden] *)").length).toBe(1);
    fireEvent.click(button(EN["header.homeConfirm.no"]));
    expect(await findButton(EN["reading.submit"])).toBeTruthy();
    fireEvent.click(backBar()!);
    fireEvent.click(button(EN["header.homeConfirm.yes"]));
    await waitFor(() => expect(onHome()).toBe(true));
  });
  it("browser Back from Study goes home without a question", async () => {
    app();
    fireEvent.click(button(EN["home.study.title"]));
    await waitFor(() => expect(window.history.state).toEqual({ languageLabSection: true }));
    window.history.back();
    await waitFor(() => expect(onHome()).toBe(true));
  });
  it("browser Back in a practice asks first and stays; Leave then goes home", async () => {
    app();
    fireEvent.click(button(EN["home.part.reading.title"]));
    await findButton(EN["reading.submit"]);
    window.history.back();
    await waitFor(() => expect(screen.getByText(EN["header.homeConfirm"])).toBeTruthy());
    expect(onHome()).toBe(false);
    await waitFor(() => expect(window.history.state).toEqual({ languageLabSection: true }));
    fireEvent.click(button(EN["header.homeConfirm.yes"]));
    await waitFor(() => expect(onHome()).toBe(true));
  });
  it("browser Back from a report goes home", async () => {
    app();
    await toReadingReport();
    window.history.back();
    await waitFor(() => expect(onHome()).toBe(true));
  });
});
describe("the new Home: Who, then What (Q3)", () => {
  it("exactly one filled button (Practice test); every card has a verb and an arrow", () => {
    app();
    const primaries = [...document.querySelectorAll("main .btn--primary")];
    expect(primaries).toHaveLength(1);
    expect(primaries[0]!.textContent).toContain(EN["home.full.title"]);
    for (const card of document.querySelectorAll("main .action-card")) {
      expect(card.querySelector(".action-card__go")!.textContent!.trim().length).toBeGreaterThan(0);
      expect(card.querySelector(".action-card__arrow")).not.toBeNull();
    }
  });
  it("Most people is chosen at first; 65/20 shows 'Not required for 65/20' on Reading and Writing and opens Study with the starred questions", async () => {
    app();
    expect(document.querySelector<HTMLInputElement>('input[name="who"][value="most"]')!.checked).toBe(true);
    expect(document.body.textContent).toContain(EN["home.who.notSure"]);
    expect(document.body.textContent).not.toContain(EN["home.part.notRequired"]);
    fireEvent.click(document.querySelector<HTMLInputElement>('input[name="who"][value="special"]')!);
    expect(document.querySelectorAll(".action-card__meta").length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).toContain(EN["home.part.notRequired"]);
    fireEvent.click(button(EN["home.study.title"]));
    expect(screen.getByLabelText<HTMLInputElement>(EN["study.special.label"]).checked).toBe(true);
  });
  it("65/20 then Practice test: setup has 65/20 ticked, so it is not asked twice", async () => {
    app();
    fireEvent.click(document.querySelector<HTMLInputElement>('input[name="who"][value="special"]')!);
    fireEvent.click(button(EN["home.full.title"]));
    expect(screen.getByLabelText<HTMLInputElement>(EN["intro.special.label"]).checked).toBe(true);
  });
});
