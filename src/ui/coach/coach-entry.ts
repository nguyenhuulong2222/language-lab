/**
 * src/ui/coach/coach-entry.ts
 *
 * How the N-400 stage starts when the AI coach is offered (spec REQ-C19): ask first, or open the
 * consent notice at once (the home coach card). Pure, so every path is tested without a browser.
 * Consent itself is given only by "confirm", which the screen passes on to the AI coach session.
 */
export type CoachEntry = "choice" | "notice";
export type CoachEntryState = "choice" | "notice" | "done";
export type CoachEntryEvent = "use" | "no" | "cancel" | "confirm";

/** The first state: nothing to ask when the coach is not offered or the interview has started. */
export function initialCoachEntry(offered: boolean, answered: number, entry: CoachEntry): CoachEntryState {
  if (!offered || answered > 0) return "done";
  return entry === "notice" ? "notice" : "choice";
}

export function nextCoachEntry(state: CoachEntryState, event: CoachEntryEvent): CoachEntryState {
  switch (state) {
    case "choice":
      if (event === "use") return "notice";
      if (event === "no") return "done";
      return state;
    case "notice":
      if (event === "cancel") return "choice";
      if (event === "confirm") return "done";
      return state;
    case "done":
      return state;
  }
}
