/**
 * src/engine/coach/config.ts
 *
 * The one config file of the AI coach: data/coach-config.json (spec REQ-C04, REQ-C10). The parser
 * checks every field and its range, so a typo cannot open a limit. `temperature` must be null:
 * Anthropic API version 2026-10-21 removed it.
 *
 * Pure module: no DOM, no network.
 */
import RAW from "../../../data/coach-config.json" with { type: "json" };

export interface CoachConfig {
  model: {
    id: string;
    apiVersion: string;
    maxTokens: number;
    effort: "low" | "medium" | "high";
    thinking: "disabled";
    temperature: null;
    inputUsdPerMillionTokens: number;
    outputUsdPerMillionTokens: number;
    checkedOn: string;
  };
  reply: { followUpMaxChars: number; tipMaxChars: number };
  limits: {
    maxAnswerChars: number;
    maxRequestBytes: number;
    maxTurnsPerSession: number;
    perIpPerHour: number;
    perIpPerDay: number;
    dailyRequestBudget: number;
    dailySpendCapUsd: number;
    fixedInputTokens: number;
    charsPerToken: number;
    upstreamTimeoutMs: number;
    clientTimeoutMs: number;
    cleanupBatch: number;
  };
  origins: { exact: string[]; previewSuffix: string };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function fail(path: string, rule: string): never {
  throw new Error(`coach-config: ${path} ${rule}.`);
}
function int(obj: Record<string, unknown>, key: string, path: string, min: number, max: number): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) fail(`${path}.${key}`, `must be a whole number from ${min} to ${max}`);
  return v;
}
function num(obj: Record<string, unknown>, key: string, path: string, min: number, max: number): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) fail(`${path}.${key}`, `must be a number from ${min} to ${max}`);
  return v;
}
function str(obj: Record<string, unknown>, key: string, path: string, pattern: RegExp): string {
  const v = obj[key];
  if (typeof v !== "string" || !pattern.test(v)) fail(`${path}.${key}`, `must match ${pattern}`);
  return v;
}
function section(raw: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = raw[key];
  if (!isRecord(v)) fail(key, "must be an object");
  return v;
}
function onlyKeys(obj: Record<string, unknown>, path: string, allowed: readonly string[]): void {
  for (const key of Object.keys(obj)) {
    if (!key.startsWith("_") && !allowed.includes(key)) fail(`${path}.${key}`, "is not a known setting");
  }
}

export function parseCoachConfig(raw: unknown): CoachConfig {
  if (!isRecord(raw)) fail("file", "must be a JSON object");
  onlyKeys(raw, "config", ["model", "reply", "limits", "origins"]);
  const m = section(raw, "model");
  onlyKeys(m, "model", ["id", "apiVersion", "maxTokens", "effort", "thinking", "temperature", "inputUsdPerMillionTokens", "outputUsdPerMillionTokens", "checkedOn"]);
  if (m["temperature"] !== null) fail("model.temperature", "must be null (API version 2026-10-21 rejects temperature)");
  const effort = m["effort"];
  if (effort !== "low" && effort !== "medium" && effort !== "high") fail("model.effort", 'must be "low", "medium" or "high"');
  if (m["thinking"] !== "disabled") fail("model.thinking", 'must be "disabled"');
  const r = section(raw, "reply");
  onlyKeys(r, "reply", ["followUpMaxChars", "tipMaxChars"]);
  const l = section(raw, "limits");
  const limitKeys = [
    "maxAnswerChars", "maxRequestBytes", "maxTurnsPerSession", "perIpPerHour", "perIpPerDay", "dailyRequestBudget",
    "dailySpendCapUsd", "fixedInputTokens", "charsPerToken", "upstreamTimeoutMs", "clientTimeoutMs", "cleanupBatch",
  ];
  onlyKeys(l, "limits", limitKeys);
  const o = section(raw, "origins");
  onlyKeys(o, "origins", ["exact", "previewSuffix"]);
  const exact = o["exact"];
  if (!Array.isArray(exact) || exact.length === 0 || !exact.every((x) => typeof x === "string" && /^https?:\/\/[a-z0-9.-]+(:\d+)?$/.test(x))) {
    fail("origins.exact", "must be a non-empty list of origins like https://host or http://localhost:8788");
  }
  for (const origin of exact as string[]) {
    if (origin.startsWith("http://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) fail("origins.exact", "may use http only for localhost");
  }
  const config: CoachConfig = {
    model: {
      id: str(m, "id", "model", /^claude-[a-z0-9-]+$/),
      apiVersion: str(m, "apiVersion", "model", /^\d{4}-\d{2}-\d{2}$/),
      maxTokens: int(m, "maxTokens", "model", 64, 1024),
      effort,
      thinking: "disabled",
      temperature: null,
      inputUsdPerMillionTokens: num(m, "inputUsdPerMillionTokens", "model", 0.01, 100),
      outputUsdPerMillionTokens: num(m, "outputUsdPerMillionTokens", "model", 0.01, 500),
      checkedOn: str(m, "checkedOn", "model", /^\d{4}-\d{2}-\d{2}$/),
    },
    reply: {
      followUpMaxChars: int(r, "followUpMaxChars", "reply", 20, 300),
      tipMaxChars: int(r, "tipMaxChars", "reply", 20, 400),
    },
    limits: {
      maxAnswerChars: int(l, "maxAnswerChars", "limits", 20, 2000),
      maxRequestBytes: int(l, "maxRequestBytes", "limits", 512, 16384),
      maxTurnsPerSession: int(l, "maxTurnsPerSession", "limits", 1, 50),
      perIpPerHour: int(l, "perIpPerHour", "limits", 1, 500),
      perIpPerDay: int(l, "perIpPerDay", "limits", 1, 2000),
      dailyRequestBudget: int(l, "dailyRequestBudget", "limits", 1, 20000),
      dailySpendCapUsd: num(l, "dailySpendCapUsd", "limits", 0.01, 50),
      fixedInputTokens: int(l, "fixedInputTokens", "limits", 100, 10000),
      charsPerToken: int(l, "charsPerToken", "limits", 1, 6),
      upstreamTimeoutMs: int(l, "upstreamTimeoutMs", "limits", 1000, 30000),
      clientTimeoutMs: int(l, "clientTimeoutMs", "limits", 1000, 60000),
      cleanupBatch: int(l, "cleanupBatch", "limits", 1, 500),
    },
    origins: { exact: exact as string[], previewSuffix: str(o, "previewSuffix", "origins", /^\.[a-z0-9-]+(\.[a-z0-9-]+)+$/) },
  };
  if (config.limits.perIpPerHour > config.limits.perIpPerDay) fail("limits.perIpPerHour", "must not exceed perIpPerDay");
  if (config.limits.clientTimeoutMs <= config.limits.upstreamTimeoutMs) fail("limits.clientTimeoutMs", "must be longer than upstreamTimeoutMs");
  // A full-length answer (up to 3 UTF-8 bytes per character) must fit in the body with the other fields.
  if (config.limits.maxAnswerChars * 3 + 1024 > config.limits.maxRequestBytes) fail("limits.maxRequestBytes", "is too small for maxAnswerChars");
  return config;
}

export function loadCoachConfig(): CoachConfig {
  return parseCoachConfig(RAW);
}
