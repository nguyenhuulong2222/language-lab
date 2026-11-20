/**
 * Disclaimers and legal lines. Owner rule: legal text is never machine translated. In every language
 * whose locale file has no named human reviewer, these keys are shown in English only (the locale
 * file still holds an AI draft of each, for the reviewer to check; it is not shown). One short
 * translated line (aiNotice.legalEnglish, on every screen) says why.
 *
 * A key belongs here when it is a disclaimer, a statement about USCIS, the test or the scoring rules,
 * a privacy or data-handling notice, or a statement about what the app does with the user's voice.
 * Every key must exist in en.json (a test checks it).
 *
 * Pure module: no React, no DOM.
 */
export const LEGAL_KEYS: readonly string[] = [
  "disclaimer.title",
  "disclaimer.short",
  "disclaimer.full",
  "disclaimer.report",
  "intro.notice.practice",
  "intro.notice.legal",
  "intro.notice.government",
  "intro.privacy",
  "intro.filed.help",
  "intro.locked",
  "voice.privacy",
  "voice.consent.text",
  "selfReview.privacy",
  "n400.sample.note",
  "help.setup.2",
  "lang.interviewEnglish",
  "partReport.scope",
  "report.n400Note",
  "compare.setting",
  "compare.setting.writing",
  "credits.lead",
  "civics.officialNote",
  "civics.locked.text",
  "study.locked",
  "compare.vocab",
  "civics.stopped.correct",
  "civics.stopped.incorrect",
];

const SET: ReadonlySet<string> = new Set(LEGAL_KEYS);

export function isLegalKey(key: string): boolean {
  return SET.has(key);
}
