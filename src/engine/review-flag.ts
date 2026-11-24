/**
 * src/engine/review-flag.ts
 *
 * The review flag of a content file (spec release-finish REQ-F02, audit CON-06). `needsHumanReview`
 * is true or false. A file may say false only when it names its reviewer (`reviewedBy`) and an ISO
 * review date (`reviewedOn`, YYYY-MM-DD), as the answer keys do. Reviewed content loads; nothing
 * here changes a flag.
 *
 * Pure module: no DOM, no network.
 */

/** The problem with a file's review fields, or null when they are valid. */
export function reviewFlagProblem(raw: Record<string, unknown>): string | null {
  const flag = raw["needsHumanReview"];
  if (typeof flag !== "boolean") return "needsHumanReview must be true or false";
  if (flag) return null;
  const by = raw["reviewedBy"];
  const on = raw["reviewedOn"];
  if (typeof by !== "string" || by.trim() === "") return "needsHumanReview is false but reviewedBy names no reviewer";
  if (typeof on !== "string" || !isIsoDate(on)) return "needsHumanReview is false but reviewedOn is not a date (YYYY-MM-DD)";
  return null;
}

function isIsoDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}
