/**
 * The optional AI coach on the client (spec REQ-C07, REQ-C08, REQ-C11, REQ-C14, REQ-C16). The
 * transport is a spy: no test calls /api/coach for real, and none calls Anthropic.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { createAiCoachSession, COACH_ENDPOINT, type CoachTransport } from "../coach/ai-coach-client";
import { createAiN400Coach } from "../coach/ai-n400-coach";
import { initialCoachEntry, nextCoachEntry } from "../coach/coach-entry";
import { loadCoachConfig } from "../../engine/coach/config";
import { createScriptedN400Coach } from "../../engine/n400-coach";
import { loadPracticeContent } from "../../engine/practice-content";
import { createDefaultPracticeEnv, createPracticeEngine } from "../../engine/practice-flow";
import { CoachSwitch } from "../components/CoachSwitch";
import { CoachFeedback } from "../components/CoachFeedback";
import { N400Screen } from "../screens/N400Screen";
import { PracticeApp } from "../PracticeApp";
import { HomeScreen } from "../screens/HomeScreen";
import { I18nProvider } from "../../i18n/react";
import { ENGLISH_MESSAGES } from "../../i18n";

const config = loadCoachConfig();
const content = loadPracticeContent();
const profile = content.profiles[0]!;
const question = content.n400Questions[0]!;
const reply = { followUp: "Have you used any other names?", feedback: "understood" as const, tip: "Good, you used a full sentence." };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const spy = (body: unknown = { status: "ok", reply }, status = 200) => vi.fn<CoachTransport>(async () => respond(body, status));
const turn = (answer = "My name is Aurora Thistlewood.") => ({ profileId: profile.id, questionId: question.id, answer });
afterEach(() => vi.unstubAllGlobals());

describe("consent (REQ-C07)", () => {
  it("off by default: submit makes no call", async () => {
    const transport = spy();
    const s = createAiCoachSession({ transport, config });
    expect(s.consent).toBe(false);
    expect(await s.submit(turn())).toEqual({ kind: "off" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("after consent: one POST to /api/coach with only the current answer and ids", async () => {
    const transport = spy();
    const s = createAiCoachSession({ transport, config, newSessionId: () => "0123456789abcdef0123456789abcdef" });
    s.giveConsent();
    expect(await s.submit(turn())).toEqual({ kind: "ai", reply });
    expect(transport).toHaveBeenCalledTimes(1);
    const [url, init] = transport.mock.calls[0]!;
    expect(url).toBe(COACH_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ sessionId: "0123456789abcdef0123456789abcdef", ...turn() });
  });
  it("withdrawing consent stops all calls", async () => {
    const transport = spy();
    const s = createAiCoachSession({ transport, config });
    s.giveConsent();
    s.withdraw();
    expect(await s.submit(turn())).toEqual({ kind: "off" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("a new session (a new practice) starts off again", () => {
    expect(createAiCoachSession({ transport: spy(), config }).consent).toBe(false);
  });
});

describe("the identifier screen runs before anything is sent (REQ-C08)", () => {
  it("refuses with the kind and makes no call", async () => {
    const transport = spy();
    const s = createAiCoachSession({ transport, config });
    s.giveConsent();
    for (const [answer, kind] of [["A123456789", "a-number"], ["555-123-4567", "phone"], ["me@example.com", "email"]] as const) {
      expect(await s.submit(turn(answer))).toEqual({ kind: "screened", found: kind });
    }
    expect(transport).not.toHaveBeenCalled();
  });
  it("too long or empty answers are not sent", async () => {
    const transport = spy();
    const s = createAiCoachSession({ transport, config });
    s.giveConsent();
    expect((await s.submit(turn("a".repeat(config.limits.maxAnswerChars + 1)))).kind).toBe("fallback");
    expect((await s.submit(turn("   "))).kind).toBe("fallback");
    expect(transport).not.toHaveBeenCalled();
  });
});

describe("fallback (REQ-C11)", () => {
  const cases: Array<[unknown, number, { reason: string; disable: boolean }]> = [
    [{ status: "unavailable", reason: "off" }, 503, { reason: "unavailable", disable: true }],
    [{ status: "unavailable", reason: "not_configured" }, 503, { reason: "unavailable", disable: true }],
    [{ status: "unavailable", reason: "budget" }, 503, { reason: "unavailable", disable: true }],
    [{ status: "unavailable", reason: "spend" }, 503, { reason: "unavailable", disable: true }],
    [{ status: "unavailable", reason: "upstream" }, 502, { reason: "unavailable", disable: false }],
    [{ status: "unavailable", reason: "timeout" }, 504, { reason: "timeout", disable: false }],
    [{ status: "limited", reason: "ip" }, 429, { reason: "limited", disable: false }],
    [{ status: "limited", reason: "session" }, 429, { reason: "session_limit", disable: true }],
    [{ status: "rejected", reason: "tip_outcome" }, 502, { reason: "rejected", disable: false }],
    [{ status: "forbidden" }, 403, { reason: "error", disable: false }],
    ["not json", 500, { reason: "error", disable: false }],
  ];
  it("every non-ok answer becomes the fallback, and the coach switches off when the server says so", async () => {
    for (const [body, status, expected] of cases) {
      const transport = vi.fn<CoachTransport>(async () => (typeof body === "string" ? new Response(body, { status }) : respond(body, status)));
      const s = createAiCoachSession({ transport, config });
      s.giveConsent();
      const r = await s.submit(turn());
      expect(r, JSON.stringify(body)).toEqual({ kind: "fallback", ...expected });
      expect(s.consent, JSON.stringify(body)).toBe(!expected.disable);
      expect(s.available).toBe(!expected.disable);
    }
  });
  it("a network error or timeout is a fallback, never a retry", async () => {
    for (const [error, reason] of [[new TypeError("offline"), "network"], [Object.assign(new Error("t"), { name: "TimeoutError" }), "timeout"]] as const) {
      const transport = vi.fn<CoachTransport>(async () => { throw error; });
      const s = createAiCoachSession({ transport, config });
      s.giveConsent();
      expect(await s.submit(turn())).toEqual({ kind: "fallback", reason, disable: false });
      expect(transport).toHaveBeenCalledTimes(1);
    }
  });
  it("the turn limit per session is kept on the client", async () => {
    const transport = spy();
    const s = createAiCoachSession({ transport, config });
    s.giveConsent();
    for (let i = 0; i < config.limits.maxTurnsPerSession; i++) expect((await s.submit(turn())).kind).toBe("ai");
    expect(await s.submit(turn())).toEqual({ kind: "fallback", reason: "session_limit", disable: true });
    expect(transport).toHaveBeenCalledTimes(config.limits.maxTurnsPerSession);
    expect(s.consent).toBe(false);
  });
});

describe("the AI coach as an N400Coach (REQ-C01)", () => {
  it("questions come from the scripted coach; earlier answers are never sent", async () => {
    const transport = spy();
    const s = createAiCoachSession({ transport, config });
    s.giveConsent();
    const scripted = createScriptedN400Coach(content.n400Questions);
    const ai = createAiN400Coach(scripted, s);
    expect(await ai.nextQuestion({ profile, answered: [] })).toEqual(await scripted.nextQuestion({ profile, answered: [] }));
    const earlier = [{ questionId: "n400-001", questionText: "x", transcript: "EARLIER ANSWER TEXT" }];
    await ai.turnFeedback({ profile, answered: earlier }, { questionId: question.id, questionText: question.text, transcript: "Now." });
    expect(String(transport.mock.calls[0]![1].body)).not.toContain("EARLIER ANSWER TEXT");
    expect(await ai.feedback({ profile, answered: [] }, { questionId: question.id, questionText: question.text, transcript: "Now." })).toEqual({ feedback: "understood" });
    expect(transport).toHaveBeenCalledTimes(1); // feedback() made no second call
  });
});

describe("the app never calls /api/coach while consent is off (REQ-C16)", () => {
  it("rendering the N-400 screen and the whole app does not fetch", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const transport = vi.fn<CoachTransport>();
    renderToString(
      <N400Screen coach={createScriptedN400Coach(content.n400Questions)} profile={profile} answers={[]} onAnswer={() => {}} onFinish={() => {}} coachTransport={transport} />
    );
    const engine = createPracticeEngine(createDefaultPracticeEnv());
    let s = engine.reduce(engine.initial(), { type: "choose", mode: "n400", seed: 1, at: "2026-11-20T10:00:00Z" });
    s = engine.reduce(s, { type: "start", profileId: profile.id, seed: 1, at: "2026-11-20T10:00:00Z" });
    renderToString(<PracticeApp engine={engine} />);
    expect(transport).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("only ai-coach-client.ts names the endpoint, and it calls the transport only after the consent check", async () => {
    const sources = import.meta.glob("../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    // Code only: comments may mention the endpoint.
    const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*$/gm, "");
    const naming = Object.entries(sources).filter(([f, t]) => !f.includes("__tests__") && code(t).includes("/api/coach")).map(([f]) => f);
    expect(naming).toEqual(["../coach/ai-coach-client.ts"]);
    const client = sources["../coach/ai-coach-client.ts"]!;
    expect(client.indexOf("if (!consent || sessionId === null)")).toBeLessThan(client.indexOf("await transport("));
  });
});

describe("interface (REQ-C14)", () => {
  const sw = (props: Partial<Parameters<typeof CoachSwitch>[0]> = {}, language: "en" | "vi" = "en") =>
    renderToString(
      <I18nProvider language={language}>
        <CoachSwitch on={false} noticeOpen={false} offForSession={false} onRequestOn={() => {}} onTurnOff={() => {}} onConfirm={() => {}} onCancel={() => {}} {...props} />
      </I18nProvider>
    );
  it("switched off for the session: still focusable (aria-disabled), with the reason", () => {
    const html = sw({ offForSession: true });
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain("The AI coach is off for the rest of this practice.");
  });
  it("a labelled switch, off by default", () => {
    const html = sw();
    expect(html).toContain("AI coach (optional)");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain(ENGLISH_MESSAGES["coach.notice.text"]);
  });
  it("the notice before it turns on, with confirm and cancel", () => {
    const html = sw({ noticeOpen: true });
    expect(html).toContain("Before you turn on the AI coach");
    expect(html).toContain("sent as text to Anthropic");
    expect(html).toContain("Turn on the AI coach");
    expect(html).toContain("Cancel");
  });
  it("the notice is English in an unreviewed language; the label is translated", () => {
    const html = sw({ noticeOpen: true }, "vi");
    expect(html).toContain(ENGLISH_MESSAGES["coach.notice.text"].replace(/'/g, "&#x27;"));
    expect(html).toContain("Huấn luyện viên AI (không bắt buộc)");
  });
  it("while on, the three disclaimers in English", () => {
    const html = sw({ on: true }, "vi");
    for (const key of ["intro.notice.practice", "intro.notice.legal", "intro.notice.government"] as const) expect(html).toContain(ENGLISH_MESSAGES[key]);
    expect(html).toContain('aria-checked="true"');
  });
  const fb = (step: Parameters<typeof CoachFeedback>[0]["step"], language: "en" | "vi" = "en") =>
    renderToString(
      <I18nProvider language={language}>
        <CoachFeedback step={step} onNext={() => {}} />
      </I18nProvider>
    );
  it("every AI line carries the AI-generated label and is English", () => {
    const html = fb({ status: "done", result: { kind: "ai", reply } });
    expect(html.match(/AI-generated feedback/g)?.length).toBe(3);
    expect(html).toContain(`<span lang="en">${reply.tip}</span>`);
    expect(html).toContain(`<span lang="en">${reply.followUp}</span>`);
    expect(html).toContain("Easy to understand");
    expect(html).toContain("It does not say whether an answer is right or true.");
    expect(html).toContain(ENGLISH_MESSAGES["disclaimer.report"]);
    expect(html).toContain("Continue");
    // One status region, mounted while checking too, holds the result; Continue is outside it.
    expect(html).toMatch(/role="status" aria-live="polite"/);
    expect(html.indexOf("Continue")).toBeGreaterThan(html.lastIndexOf('aria-live="polite"'));
  });
  it("the plain fallback line, and the off-for-session note when disabled", () => {
    const html = fb({ status: "done", result: { kind: "fallback", reason: "unavailable", disable: true } });
    expect(html).toContain("AI feedback is not available right now.");
    expect(html).toContain("The AI coach is off for the rest of this practice.");
    expect(html).not.toContain("AI-generated feedback");
  });
  it("a screened answer says why; in Vietnamese the whole line is English", () => {
    expect(fb({ status: "done", result: { kind: "screened", found: "phone" } })).toContain("seems to contain a phone number");
    expect(fb({ status: "done", result: { kind: "screened", found: "phone" } }, "vi")).toContain("seems to contain a phone number");
  });
  it("while checking, no Next button yet", () => {
    const html = fb({ status: "checking" });
    expect(html).toContain("Getting AI feedback");
    expect(html).toMatch(/role="status" aria-live="polite"/);
    expect(html).not.toContain("Continue");
  });
});

describe("discoverable coach: home card (REQ-C18)", () => {
  const home = (props: Partial<Parameters<typeof HomeScreen>[0]> = {}) =>
    renderToString(<HomeScreen civicsLocked={false} onChoose={() => {}} onStudy={() => {}} onChooseCoach={() => {}} {...props} />);
  it("the card sits directly under the full-interview card, with the attribution line", () => {
    const html = home();
    const full = html.indexOf("Full practice interview");
    const card = html.indexOf("Practice the N-400 interview with an AI coach");
    const study = html.indexOf("Study first");
    expect(full).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(full);
    expect(card).toBeLessThan(study);
    expect(html).toContain("The coach asks a follow-up like an officer might and gives tips on your English. Optional.");
    expect(html).toContain("Powered by Claude (Anthropic)");
  });
  it("the N-400 part card carries a word badge \"AI\", not a colour", () => {
    // Seen: the word "AI". Heard: "AI coach (optional)", so the badge does not suggest the part always uses AI.
    expect(home().replace(/<!-- -->/g, "")).toMatch(/N-400 interview <span class="option-card__badge" aria-hidden="true">AI<\/span><span class="ll-sr-only">AI coach \(optional\)<\/span>/);
    expect(home({ onChooseCoach: undefined })).not.toContain("option-card__badge");
  });
  it("the card's name is its title; the text and the attribution are its description", () => {
    const html = home();
    const tag = html.slice(html.lastIndexOf("<button", html.indexOf("option-card--coach")), html.indexOf(">", html.indexOf("option-card--coach")));
    const labelledby = /aria-labelledby="([^"]+)"/.exec(tag)![1]!;
    const describedby = /aria-describedby="([^"]+)"/.exec(tag)![1]!.split(" ");
    expect(html).toContain(`id="${labelledby}" class="option-card__title">Practice the N-400 interview with an AI coach<`);
    expect(describedby).toHaveLength(2);
    expect(html).toContain(`id="${describedby[1]}" class="option-card__meta">Powered by Claude (Anthropic)<`);
  });
  it("no logo or brand artwork: no image or svg on the card", () => {
    const html = home();
    const card = html.slice(html.indexOf("option-card--coach"), html.indexOf("Powered by Claude (Anthropic)"));
    expect(card).not.toMatch(/<img|<svg/);
  });
});

describe("discoverable coach: the choice before the first question (REQ-C19)", () => {
  const scripted = createScriptedN400Coach(content.n400Questions);
  const screen = (props: Partial<Parameters<typeof N400Screen>[0]> = {}) => {
    const transport = vi.fn<CoachTransport>();
    const html = renderToString(
      <N400Screen coach={scripted} profile={profile} answers={[]} onAnswer={() => {}} onFinish={() => {}} coachTransport={transport} {...props} />
    );
    return { html, transport };
  };
  it("a normal entry asks first, with two large buttons and the disclaimers; nothing is sent", () => {
    const { html, transport } = screen();
    expect(html).toContain("Would you like to use the AI coach?");
    expect(html).toContain("Use the AI coach");
    expect(html).toContain("No, practice without AI");
    expect(html).toContain("Powered by Claude (Anthropic)");
    for (const key of ["intro.notice.practice", "intro.notice.legal", "intro.notice.government"] as const) expect(html).toContain(ENGLISH_MESSAGES[key]);
    expect(html).not.toContain("sent as text to Anthropic");
    expect(html).not.toContain(question.text);
    expect(transport).not.toHaveBeenCalled();
  });
  it("\"Use\" is named by its title, with the attribution as its description", () => {
    const { html } = screen();
    const tag = /<button[^>]*option-card--coach[^>]*>/.exec(html)![0];
    const labelledby = /aria-labelledby="([^"]+)"/.exec(tag)![1]!;
    const describedby = /aria-describedby="([^"]+)"/.exec(tag)![1]!;
    expect(html).toContain(`id="${labelledby}" class="option-card__title">Use the AI coach<`);
    expect(html).toContain(`id="${describedby}" class="option-card__meta">Powered by Claude (Anthropic)<`);
  });
  it("from the home coach card the notice is open at once; still nothing is sent", () => {
    const { html, transport } = screen({ coachEntry: "notice" });
    expect(html).toContain("Before you turn on the AI coach");
    expect(html).toContain("sent as text to Anthropic");
    expect(html).toContain("Turn on the AI coach");
    expect(html).not.toContain("No, practice without AI");
    expect(transport).not.toHaveBeenCalled();
  });
  it("no choice when the coach is not offered, or once the interview has started", () => {
    expect(renderToString(<N400Screen coach={scripted} profile={profile} answers={[]} onAnswer={() => {}} onFinish={() => {}} />)).not.toContain("Would you like to use the AI coach?");
    const started = screen({ answers: [{ questionId: question.id, questionText: question.text, transcript: "x" }] });
    expect(started.html).not.toContain("Would you like to use the AI coach?");
    expect(started.html).toContain('role="switch"');
  });
  it("the entry paths: Use → notice → Confirm; Use → notice → Cancel → choice; No → questions", () => {
    expect(initialCoachEntry(true, 0, "choice")).toBe("choice");
    expect(initialCoachEntry(true, 0, "notice")).toBe("notice");
    expect(initialCoachEntry(false, 0, "notice")).toBe("done");
    expect(initialCoachEntry(true, 2, "choice")).toBe("done");
    expect(nextCoachEntry("choice", "use")).toBe("notice");
    expect(nextCoachEntry("notice", "confirm")).toBe("done");
    expect(nextCoachEntry("notice", "cancel")).toBe("choice");
    expect(nextCoachEntry("choice", "no")).toBe("done");
    // "confirm" is not reachable from the choice screen: consent needs the notice.
    expect(nextCoachEntry("choice", "confirm")).toBe("choice");
    expect(nextCoachEntry("done", "use")).toBe("done");
  });
  it("\"No\": the session stays without consent and the transport is never called", async () => {
    const transport = spy();
    const s = createAiCoachSession({ transport, config });
    // The screen does nothing to the session on "No"; answers go straight to the scripted coach.
    const ai = createAiN400Coach(scripted, s);
    expect(await ai.turnFeedback({ profile, answered: [] }, { questionId: question.id, questionText: question.text, transcript: "My name is Aurora Thistlewood." })).toEqual({ kind: "off" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("only the notice's Confirm gives consent (source check of the screen)", async () => {
    const sources = import.meta.glob("../screens/N400Screen.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const src = Object.values(sources)[0]!;
    expect(src.match(/giveConsent\(\)/g)?.length).toBe(2); // the choice screen's notice and the switch's notice
    for (const m of src.matchAll(/onConfirm=\{\(\) => \{\s*(?:\/\/[^\n]*\s*)?session\.giveConsent\(\)/g)) expect(m[0]).toContain("onConfirm");
    expect(src).not.toMatch(/onUse=\{[^}]*giveConsent/);
    expect(src).not.toMatch(/onNo=\{[^}]*giveConsent/);
  });
});

describe("attribution as text only (REQ-C20)", () => {
  const POWERED = "Powered by Claude (Anthropic)";
  const scripted = createScriptedN400Coach(content.n400Questions);
  const surfaces: Array<[string, string]> = [
    ["home card", renderToString(<HomeScreen civicsLocked={false} onChoose={() => {}} onStudy={() => {}} onChooseCoach={() => {}} />)],
    ["choice screen", renderToString(<N400Screen coach={scripted} profile={profile} answers={[]} onAnswer={() => {}} onFinish={() => {}} coachTransport={vi.fn<CoachTransport>()} />)],
    ["notice", renderToString(<N400Screen coach={scripted} profile={profile} answers={[]} onAnswer={() => {}} onFinish={() => {}} coachTransport={vi.fn<CoachTransport>()} coachEntry="notice" />)],
    ["switch notice", renderToString(<CoachSwitch on={false} noticeOpen offForSession={false} onRequestOn={() => {}} onTurnOff={() => {}} onConfirm={() => {}} onCancel={() => {}} />)],
    ["feedback step", renderToString(<CoachFeedback step={{ status: "done", result: { kind: "ai", reply } }} onNext={() => {}} />)],
  ];
  it.each(surfaces)("the %s says \"Powered by Claude (Anthropic)\" once, as text", (_name, html) => {
    expect(html.split(POWERED).length - 1).toBe(1);
  });
  it.each(surfaces)("the %s has no image or svg (no logo or brand artwork)", (name, html) => {
    if (name === "home card") {
      const card = html.slice(html.indexOf("option-card--coach"), html.indexOf(POWERED));
      expect(card).not.toMatch(/<img|<svg/);
    } else {
      expect(html).not.toMatch(/<img/);
      // The only svg allowed is the app's own status icon (check or review marker), never brand artwork.
      for (const m of html.matchAll(/<svg[^>]*>/g)) expect(m[0]).toContain('class="icon-inline"');
    }
    // The attribution line itself is plain text.
    expect(html).toMatch(/>Powered by Claude \(Anthropic\)</);
  });
  it("no attribution on fallback lines: the AI did not write them", () => {
    const html = renderToString(<CoachFeedback step={{ status: "done", result: { kind: "fallback", reason: "unavailable", disable: false } }} onNext={() => {}} />);
    expect(html).not.toContain(POWERED);
  });
  it("Claude and Anthropic are fixed terms: a translation without them fails the check", async () => {
    const { FIXED_TERMS, checkLocale } = await import("../../i18n/locale-checks");
    expect(FIXED_TERMS).toEqual(expect.arrayContaining(["Claude", "Anthropic"]));
    const en = { "coach.poweredBy": POWERED };
    expect(checkLocale(en, { "coach.poweredBy": "Hỗ trợ bởi Claude (Anthropic)" })).toEqual([]);
    expect(checkLocale(en, { "coach.poweredBy": "Hỗ trợ bởi Klod (Anthropic)" }).map((p) => p.kind)).toEqual(["fixed-term"]);
    expect(checkLocale(en, { "coach.poweredBy": "Hỗ trợ bởi Claude (Anthrópic)" }).map((p) => p.kind)).toEqual(["fixed-term"]);
  });
});

describe("coach text in other languages (REQ-C21)", () => {
  const scripted = createScriptedN400Coach(content.n400Questions);
  const vi_ = (props: Partial<Parameters<typeof N400Screen>[0]> = {}) =>
    renderToString(
      <I18nProvider language="vi">
        <N400Screen coach={scripted} profile={profile} answers={[]} onAnswer={() => {}} onFinish={() => {}} coachTransport={vi.fn<CoachTransport>()} {...props} />
      </I18nProvider>
    );
  it("the choice screen is translated; the three disclaimers stay English", () => {
    const html = vi_();
    expect(html).toContain("Bạn có muốn dùng huấn luyện viên AI không?");
    expect(html).toContain("Claude (Anthropic)");
    expect(html).not.toContain("Would you like to use the AI coach?");
    for (const key of ["intro.notice.practice", "intro.notice.legal", "intro.notice.government"] as const) expect(html).toContain(ENGLISH_MESSAGES[key]);
  });
  it("the notice opened from the home card: consent text in English, attribution translated", () => {
    const html = vi_({ coachEntry: "notice" });
    expect(html).toContain(ENGLISH_MESSAGES["coach.notice.text"].replace(/'/g, "&#x27;"));
    expect(html).not.toContain("Powered by Claude (Anthropic)");
    expect(html).toContain("Claude (Anthropic)");
  });
  it("the new coach keys are interface text, not legal keys", async () => {
    const { LEGAL_KEYS } = await import("../../i18n/legal-keys");
    for (const k of ["home.coach.title", "home.coach.text", "coach.poweredBy", "coach.choice.title", "coach.choice.lead", "coach.choice.use", "coach.choice.no"]) {
      expect(LEGAL_KEYS as readonly string[], k).not.toContain(k);
    }
  });
});
