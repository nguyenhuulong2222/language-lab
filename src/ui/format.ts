/**
 * Formatting helpers for the practice session UI.
 * Plain, readable output for ESL learners.
 */

/** Derive a display name from a fictional profile id, e.g.
 * "fictional-profile-aurora-vance" -> "Aurora Vance". */
export function formatProfileName(profileId: string): string {
  const prefix = "fictional-profile-";
  const core = profileId.startsWith(prefix)
    ? profileId.slice(prefix.length)
    : profileId;
  return core
    .split("-")
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(" ");
}

/** The date format locale of an interface language. */
function dateLocale(language: string): string {
  return language === "vi" ? "vi-VN" : "en-US";
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();
function dateFormat(language: string, withTime: boolean): Intl.DateTimeFormat {
  const key = `${language}:${withTime}`;
  let format = dateFormats.get(key);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(dateLocale(language), {
      dateStyle: "long",
      ...(withTime ? { timeStyle: "short" as const } : {}),
      timeZone: "UTC",
    });
    dateFormats.set(key, format);
  }
  return format;
}

/** Format an ISO date (e.g. "2024-03-15") -> "March 15, 2024" (English) or "15 tháng 3, 2024" (Vietnamese). */
export function formatDate(iso: string, language = "en"): string {
  return dateFormat(language, false).format(new Date(iso));
}

/** Format an ISO datetime (e.g. "2024-03-20T10:42:00Z") -> "March 20, 2024 at 10:42 AM". */
export function formatDateTime(iso: string, language = "en"): string {
  return dateFormat(language, true).format(new Date(iso));
}
