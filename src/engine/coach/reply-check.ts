/**
 * src/engine/coach/reply-check.ts
 *
 * Checks the model's reply before anything reaches the learner (spec REQ-C09). The first failed
 * rule wins and its reason code is returned; the text itself is never logged. A best-effort guard
 * on top of the system prompt and the strict JSON schema, not a guarantee.
 *
 * Pure module: no DOM, no network.
 */
import RAW_DENY from "../../../data/coach-deny-list.json" with { type: "json" };
import type { CoachConfig } from "./config.js";
import { screenIdentifiers } from "./identifier-screen.js";
import type { CoachReply } from "./types.js";

export interface DenyList {
  reviewedOn: string;
  officeholderNames: string[];
  titleWords: string[];
  outcomePhrases: string[];
  legalPhrases: string[];
  claimPhrases: string[];
  identifierRequestWords: string[];
  modelAnswerPhrases: string[];
}

export type ReplyCheck = { ok: true; reply: CoachReply } | { ok: false; reason: string };

const LIST_KEYS = ["officeholderNames", "titleWords", "outcomePhrases", "legalPhrases", "claimPhrases", "identifierRequestWords", "modelAnswerPhrases"] as const;

export function parseDenyList(raw: unknown): DenyList {
  if (typeof raw !== "object" || raw === null) throw new Error("coach-deny-list: must be a JSON object.");
  const r = raw as Record<string, unknown>;
  if (typeof r["reviewedOn"] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r["reviewedOn"])) throw new Error("coach-deny-list: reviewedOn must be YYYY-MM-DD.");
  const out: Record<string, unknown> = { reviewedOn: r["reviewedOn"] };
  for (const key of LIST_KEYS) {
    const list = r[key];
    if (!Array.isArray(list) || list.length === 0 || !list.every((x) => typeof x === "string" && x.trim() !== "")) {
      throw new Error(`coach-deny-list: ${key} must be a non-empty list of phrases.`);
    }
    out[key] = list;
  }
  return out as unknown as DenyList;
}

export function loadDenyList(): DenyList {
  return parseDenyList(RAW_DENY);
}

const FEEDBACK = ["understood", "needs_practice", "unclear"] as const;
/** Latin letters (with accents), digits, spaces and common punctuation. Anything else is not English. */
const ENGLISH_CHARS = /^[A-Za-z\u00C0-\u00FF0-9 .,;:!?'’"“”()\-–—/&]+$/;
/** Common English words: a reply with none of them is not English ("Eres un buen estudiante"). */
const ENGLISH_WORDS = new Set(
  "the you your is are was were be to of and in it for with do did does have has had what how where when why who which can could will would should say use try speak speaking word words sentence sentences please my me this that on at about from as more slowly clearly full answer question tell long many often every each work live lived job family time years".split(" ")
);
const looksEnglish = (text: string): boolean => (text.toLowerCase().match(/[a-z']+/g) ?? []).some((w) => ENGLISH_WORDS.has(w));
const URL_LIKE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|net|gov|edu|io|us)\b)/i;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A phrase as whole words, case-insensitive. */
function phraseRegex(phrase: string): RegExp {
  const startsWord = /^\w/.test(phrase);
  const endsWord = /\w$/.test(phrase);
  return new RegExp(`${startsWord ? "\\b" : ""}${escape(phrase).replace(/\s+/g, "\\s+")}${endsWord ? "\\b" : ""}`, "i");
}
function containsAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => phraseRegex(p).test(text));
}
/** A title followed by a capitalised word: "President Smith", "Senator Doe". */
function titleWithName(text: string, titles: readonly string[]): boolean {
  return titles.some((t) => new RegExp(`\\b${escape(t).replace(/\s+/g, "\\s+")}\\s+[A-Z][a-z]+`).test(text));
}
/** A quoted span of five or more words: a model answer. */
function quotedSentence(text: string): boolean {
  const spans = text.match(/["“”][^"“”]*["“”]/g) ?? [];
  return spans.some((s) => s.slice(1, -1).trim().split(/\s+/).length >= 5);
}

/**
 * Check a raw model reply. `allowedNames` are names the reply may use (the fictional profile's).
 * `stopReason` is the API's stop_reason; only "end_turn" is accepted.
 */
export function checkReply(
  rawText: string,
  stopReason: string | null | undefined,
  config: CoachConfig,
  deny: DenyList,
  allowedNames: readonly string[] = []
): ReplyCheck {
  if (stopReason !== "end_turn") return { ok: false, reason: `stop_${stopReason ?? "missing"}` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, reason: "not_json" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ok: false, reason: "not_object" };
  const obj = parsed as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  if (keys.join(",") !== "feedback,followUp,tip") return { ok: false, reason: "keys" };
  const { followUp, feedback, tip } = obj;
  if (typeof followUp !== "string" || typeof feedback !== "string" || typeof tip !== "string") return { ok: false, reason: "types" };
  const fb = feedback.trim().toLowerCase();
  if (!(FEEDBACK as readonly string[]).includes(fb)) return { ok: false, reason: "feedback_value" };
  const f = followUp.trim();
  const t = tip.trim();
  if (f === "" || t === "") return { ok: false, reason: "empty" };
  if (f.length > config.reply.followUpMaxChars) return { ok: false, reason: "followup_length" };
  if (t.length > config.reply.tipMaxChars) return { ok: false, reason: "tip_length" };
  if (!ENGLISH_CHARS.test(f) || !ENGLISH_CHARS.test(t) || !looksEnglish(f) || !looksEnglish(t)) return { ok: false, reason: "not_english" };
  if (!f.endsWith("?") || (f.match(/\?/g) ?? []).length !== 1) return { ok: false, reason: "followup_not_question" };
  // Names the reply may use are taken out before the name checks.
  const strip = (s: string) => allowedNames.reduce((acc, name) => (name.trim() ? acc.replace(phraseRegex(name), " ") : acc), s);
  for (const [field, text] of [["followup", f], ["tip", t]] as const) {
    if (URL_LIKE.test(text)) return { ok: false, reason: `${field}_url` };
    if (screenIdentifiers(text) !== null) return { ok: false, reason: `${field}_identifier` };
    const named = strip(text);
    if (containsAny(named, deny.officeholderNames)) return { ok: false, reason: `${field}_officeholder` };
    if (titleWithName(named, deny.titleWords)) return { ok: false, reason: `${field}_title_name` };
    if (containsAny(text, deny.outcomePhrases)) return { ok: false, reason: `${field}_outcome` };
    if (containsAny(text, deny.legalPhrases)) return { ok: false, reason: `${field}_legal` };
    if (containsAny(text, deny.claimPhrases)) return { ok: false, reason: `${field}_claim` };
  }
  if (containsAny(f, deny.identifierRequestWords)) return { ok: false, reason: "followup_asks_identifier" };
  if (quotedSentence(t) || containsAny(t, deny.modelAnswerPhrases)) return { ok: false, reason: "tip_model_answer" };
  return { ok: true, reply: { followUp: f, feedback: fb as CoachReply["feedback"], tip: t } };
}
