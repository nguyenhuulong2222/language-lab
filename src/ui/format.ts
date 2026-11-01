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

const longDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "UTC",
});

const longDateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

/** Format an ISO date (e.g. "2024-03-15") -> "March 15, 2024". */
export function formatDate(iso: string): string {
  return longDate.format(new Date(iso));
}

/** Format an ISO datetime (e.g. "2024-03-20T10:42:00Z") -> "March 20, 2024 at 10:42 AM". */
export function formatDateTime(iso: string): string {
  return longDateTime.format(new Date(iso));
}
