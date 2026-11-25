/**
 * The language grid at the top of Home. The header language button uses it on Home: instead of
 * opening a second copy of the list, it scrolls to the grid and focuses the current language.
 */
export const HOME_LANGUAGE_ID = "home-language";

/** Scroll to the Home language grid and focus the current language. False when the grid is not on screen. */
export function focusHomeLanguage(): boolean {
  if (typeof document === "undefined") return false;
  const grid = document.getElementById(HOME_LANGUAGE_ID);
  if (grid === null || grid.closest("[hidden]") !== null) return false;
  grid.scrollIntoView({ block: "start" });
  const button =
    grid.querySelector<HTMLButtonElement>('.language-menu__option[aria-current="true"]') ??
    grid.querySelector<HTMLButtonElement>(".language-menu__option");
  button?.focus();
  return true;
}
