/**
 * Browser Back inside the app, without a router. Entering a section from Home (Study, a practice,
 * a report) adds one history entry; leaving it by a button takes that entry away again, so Back on
 * Home leaves the app as usual. Back inside a section calls `onBack` (Home, or the leave question).
 *
 * The entry is tracked here, not in a component: Shell is mounted again when Study opens or closes.
 * Nothing is stored; a reload starts clean.
 */
import { useEffect, useRef } from "react";

const SECTION_STATE = { languageLabSection: true } as const;
const isSectionEntry = (state: unknown) =>
  typeof state === "object" && state !== null && (state as { languageLabSection?: unknown }).languageLabSection === true;

/** True while the section entry that this page added is in the history. */
let pushed = false;
/** True between our own history.back() and the popstate it causes, so that one is not taken for the user's Back. */
let ownBack = false;

/** Add the section entry again (the user pressed Back but stays to answer the leave question). */
export function keepSectionEntry(): void {
  window.history.pushState(SECTION_STATE, "");
  pushed = true;
}

export function useSectionHistory(inSection: boolean, onBack: () => "home" | "stay"): void {
  const latest = useRef(onBack);
  latest.current = onBack;
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (inSection) {
      if (!pushed) {
        window.history.pushState(SECTION_STATE, "");
        pushed = true;
      }
      return;
    }
    if (pushed) {
      pushed = false;
      ownBack = true;
      // Cleared after this popstate has been seen by every listener.
      window.addEventListener("popstate", () => queueMicrotask(() => (ownBack = false)), { once: true });
      window.history.back();
    } else if (isSectionEntry(window.history.state)) {
      // A reload on a section entry: Home is shown, so the entry is plain again.
      window.history.replaceState(null, "");
    }
  }, [inSection]);
  useEffect(() => {
    if (!inSection || typeof window === "undefined") return;
    const onPop = (event: PopStateEvent) => {
      if (ownBack || isSectionEntry(event.state)) return;
      // The section entry is gone now.
      pushed = false;
      if (latest.current() === "stay") keepSectionEntry();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [inSection]);
}
