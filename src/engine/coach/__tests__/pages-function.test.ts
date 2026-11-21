/**
 * functions/api/coach.ts with `fetch` stubbed: checks the request it would send to Anthropic and
 * how it reads the reply, without any network call. A store stand-in replaces D1.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../../../../functions/api/coach";
import { loadPracticeContent } from "../../practice-content";

const content = loadPracticeContent();
afterEach(() => vi.unstubAllGlobals());

/** Enough of D1 for the counters: every statement returns a row, so every limit passes. */
const passingDb = {
  prepare: () => {
    const st = { bind: () => st, first: async () => ({ count: 1 }), run: async () => ({}) };
    return st;
  },
};
const env = { COACH_ENABLED: "true", ANTHROPIC_API_KEY: "test-key-not-real", COACH_IP_SALT: "a-test-salt-of-enough-length", COACH_DB: passingDb as never };
const request = () =>
  new Request("https://language-lab-ade.pages.dev/api/coach", {
    method: "POST",
    headers: { Origin: "https://language-lab-ade.pages.dev", "content-type": "application/json" },
    body: JSON.stringify({ sessionId: "abcdefghijklmnop", profileId: content.profiles[0]!.id, questionId: content.n400Questions[0]!.id, answer: "My name is Aurora Thistlewood." }),
  });

describe("the Pages Function (fetch stubbed, no network)", () => {
  it("sends one Messages API request with the key header, API version and no temperature", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({
        content: [{ type: "text", text: JSON.stringify({ followUp: "Do you use any other names?", feedback: "understood", tip: "Good, you spoke in a full sentence." }) }],
        stop_reason: "end_turn",
        usage: { input_tokens: 800, output_tokens: 50 },
      }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchSpy);
    const res = await onRequest({ request: request(), env });
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key-not-real");
    expect(headers["anthropic-version"]).toBe("2026-10-21");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body).not.toHaveProperty("temperature");
    const json = await res.json();
    expect(json).toMatchObject({ status: "ok", reply: { feedback: "understood" } });
    expect(JSON.stringify(json)).not.toContain("test-key-not-real");
  });
  it("an upstream error body is never read or returned", async () => {
    const text = vi.fn(async () => "secret echo");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, text, json: text }) as unknown as Response));
    const res = await onRequest({ request: request(), env });
    expect(res.status).toBe(502);
    expect(text).not.toHaveBeenCalled();
    expect(await res.text()).not.toContain("secret echo");
  });
  it("a timeout of the upstream call becomes 504", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new Error("timed out"), { name: "TimeoutError" }); }));
    expect((await onRequest({ request: request(), env })).status).toBe(504);
  });
  it("with the coach switched off, fetch is never called", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await onRequest({ request: request(), env: { ...env, COACH_ENABLED: "false" } });
    expect(res.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
