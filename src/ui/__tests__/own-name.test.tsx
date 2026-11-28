// @vitest-environment jsdom
/**
 * "Use my name" (decisions log S): the whole app, driven by clicks and typing, with `fetch` as a
 * spy that records every request. The name may appear on the screen; it must never appear in a
 * request (the AI coach gets the sample profile's name), in storage, a cookie, the URL, the history
 * state or the console, and it is gone after a reload (a new mount of the app).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AppProviders } from "../AppProviders";
import { PracticeApp } from "../PracticeApp";
import { ENGLISH_MESSAGES as EN } from "../../i18n";
import { OWN_NAME_SCRIPT } from "../../engine/own-name";
const AT = "2026-11-26T10:00:00.000Z";
const NAME = "Nguyễn Văn Thường";
/** What must never leave the page: each part of the name, with and without accents. */
const LEAKS = ["Nguyễn", "Thường", "Nguyen", "Thuong", "nguyen", "thuong", "N-G-U-Y-E-N", "T-H-U-O-N-G"];
const requests: string[] = [];
let fetchSpy: ReturnType<typeof vi.fn>;
const consoleCalls: unknown[][] = [];
beforeEach(() => {
  requests.length = 0;
  consoleCalls.length = 0;
  fetchSpy = vi.fn(async (url: unknown, init?: RequestInit) => {
    requests.push(`${String(url)} ${String(init?.body ?? "")}`);
    return new Response(JSON.stringify({ status: "ok", reply: { followUp: "Have you used any other names?", feedback: "understood", tip: "Good, a full sentence." } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("speechSynthesis", { cancel() {}, speak() {}, pause() {}, resume() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  Element.prototype.scrollIntoView = () => {};
  for (const method of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void consoleCalls.push(args));
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const app = () =>
  render(
    <AppProviders>
      <PracticeApp now={() => AT} seed={() => 7} />
    </AppProviders>
  );
const button = (text: string) => screen.getAllByRole("button", { name: (name) => name === text || name.startsWith(text) }).at(-1)!;
const findButton = async (text: string) =>
  (await screen.findAllByRole("button", { name: (name) => name === text || name.startsWith(text) }, { timeout: 4000 })).at(-1)!;
const ownRadio = () => document.querySelector<HTMLInputElement>('input[name="profile"][value="own-name"]');
const nameBox = () => screen.queryByLabelText(EN["intro.ownName.label"]) as HTMLInputElement | null;
const answerBox = () => document.querySelector<HTMLTextAreaElement>("textarea")!;
const answer = async (text: string) => {
  await findButton(EN["n400.save"]);
  fireEvent.change(answerBox(), { target: { value: text } });
  fireEvent.click(button(EN["n400.save"]));
};
/** Everything outside the rendered page where a name could be kept. */
function outsideThePage(): string {
  const storage = (s: Storage) => Array.from({ length: s.length }, (_, i) => `${s.key(i)}=${s.getItem(s.key(i)!)}`).join(";");
  return [storage(localStorage), storage(sessionStorage), document.cookie, location.href, JSON.stringify(history.state), document.title, JSON.stringify(consoleCalls)].join("\n");
}
const expectNoLeak = (text: string) => {
  for (const leak of LEAKS) expect(text, leak).not.toContain(leak);
};
describe("the setup card", () => {
  it("offers 'Use my name' after the three sample people, and asks only for the name", async () => {
    app();
    fireEvent.click(button(EN["home.coach.title"]));
    const radios = [...document.querySelectorAll<HTMLInputElement>('input[name="profile"]')];
    expect(radios).toHaveLength(4);
    expect(radios.at(-1)!.value).toBe("own-name");
    expect(screen.getByText(EN["intro.profile.own.title"])).toBeTruthy();
    expect(screen.getByText(EN["intro.profile.own.sub"])).toBeTruthy();
    expect(nameBox()).toBeNull();
    fireEvent.click(ownRadio()!);
    const box = nameBox()!;
    expect(box.required).toBe(true);
    expect(box.maxLength).toBe(60);
    expect(box.getAttribute("autocomplete")).toBe("off");
    expect(box.getAttribute("spellcheck")).toBe("false");
    expect(box.closest("form")).toBeNull();
    expect(screen.getByText(EN["intro.ownName.privacy"])).toBeTruthy();
    // No other new field.
    expect(document.querySelectorAll('input[type="text"]')).toHaveLength(1);
  });
  it("keeps Start off until the name is valid", async () => {
    app();
    fireEvent.click(button(EN["home.coach.title"]));
    fireEvent.click(ownRadio()!);
    const start = button(EN["intro.start"]);
    expect(start.getAttribute("aria-disabled")).toBe("true");
    fireEvent.change(nameBox()!, { target: { value: "   " } });
    expect(start.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(EN["intro.ownName.error.empty"])).toBeTruthy();
    fireEvent.change(nameBox()!, { target: { value: "Anna 2" } });
    expect(screen.getByText(EN["intro.ownName.error.characters"])).toBeTruthy();
    fireEvent.change(nameBox()!, { target: { value: `  ${NAME}  ` } });
    expect(button(EN["intro.start"]).getAttribute("aria-disabled")).toBe("false");
  });
});
describe("a practice with my name and the AI coach on", () => {
  it("greets me by name on the device, sends only the sample name, and keeps nothing after a reload", async () => {
    app();
    fireEvent.click(button(EN["home.coach.title"]));
    fireEvent.click(ownRadio()!);
    fireEvent.change(nameBox()!, { target: { value: NAME } });
    fireEvent.click(button(EN["intro.start"]));
    await screen.findByText(EN["coach.notice.title"]);
    fireEvent.click(button(EN["coach.notice.confirm"]));

    // Question 1: the officer greets me by name; the sample answer uses my name.
    await findButton(EN["n400.save"]);
    expect(screen.getByText(`Hello, ${NAME}. Thank you for coming in today. Please have a seat.`)).toBeTruthy();
    expect(screen.getByText(`My name is ${NAME}.`)).toBeTruthy();
    expect(screen.getByText(EN["n400.idNumbers.reminder"])).toBeTruthy();
    await answer(`My name is ${NAME}.`);
    fireEvent.click(await findButton(EN["coach.next"]));

    // Question 2: the spelling question, answered on the device only.
    await screen.findByText(OWN_NAME_SCRIPT.spelling.text);
    const before = fetchSpy.mock.calls.length;
    await answer("N-G-U-Y-E-N");
    expect(fetchSpy.mock.calls.length).toBe(before);

    // Question 3: a sample-profile question, labelled so; my name in the answer is replaced.
    await findButton(EN["n400.save"]);
    expect(screen.getByText(EN["n400.sampleProfile.badge"])).toBeTruthy();
    await answer("I was born in Brazil. My name is Thường.");
    fireEvent.click(await findButton(EN["coach.next"]));

    // A spelled name with spaces is kept back with its own message, and nothing is sent.
    const kept = fetchSpy.mock.calls.length;
    await answer("Yes. T H U O N G.");
    expect(await screen.findByText(EN["coach.screened.ownName"])).toBeTruthy();
    expect(fetchSpy.mock.calls.length).toBe(kept);

    // The coach got two answers, both with the sample profile's name and none with mine.
    const coachCalls = requests.filter((r) => r.startsWith("/api/coach"));
    expect(coachCalls).toHaveLength(2);
    expect(coachCalls[0]).toContain("Aurora Thistlewood");
    expect(coachCalls[1]).toContain("Aurora Thistlewood");
    expectNoLeak(requests.join("\n"));
    expectNoLeak(outsideThePage());

    // A reload: a new page with the same storage. The name is gone.
    cleanup();
    app();
    expectNoLeak(document.body.textContent ?? "");
    fireEvent.click(button(EN["home.coach.title"]));
    expect(ownRadio()!.checked).toBe(false);
    fireEvent.click(ownRadio()!);
    expect(nameBox()!.value).toBe("");
    expectNoLeak(document.body.innerHTML);
    expectNoLeak(outsideThePage());
    expectNoLeak(requests.join("\n"));
  });
});
