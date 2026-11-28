/**
 * A native modal <dialog> that closes with its Close button, Esc, a tap on the backdrop and the
 * browser's Back button (the full-screen picture, the Study question list).
 *
 * Opening adds one history entry; every way of closing takes it away again, so the section's own
 * Back handling (src/ui/section-history.ts) is not disturbed: the entry carries the section flag,
 * so the Back that leaves it lands on the section entry, which section-history ignores, and a reload
 * while it is open is cleaned up like any section entry. Focus goes to Close on open and back to
 * the control that opened it on close (unless the caller moves it somewhere else). While it is
 * open the page behind does not scroll (a class on <html>, no inline style).
 */
import { useCallback, useEffect, useRef } from "react";

/** On <html> while a modal dialog is open: the page behind does not scroll. */
export const MODAL_OPEN_CLASS = "ll-picture-open";

export interface ModalDialog {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  closeRef: React.RefObject<HTMLButtonElement | null>;
  /** Open it, from a tap. `from` (the control that was tapped) gets focus back on close. */
  open: (from?: HTMLElement | null) => void;
  /** Close it. `returnFocus: false` when the caller moves focus itself (a jump to another question). */
  close: (options?: { returnFocus?: boolean }) => void;
  /** Close on a tap on the backdrop (the dialog element itself, outside its content). */
  onDialogClick: (event: React.MouseEvent<HTMLDialogElement>) => void;
}

export function useModalDialog(historyState: Readonly<Record<string, true>>): ModalDialog {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  /** True while this dialog's history entry is in the history. */
  const entry = useRef(false);
  const returnFocus = useRef(true);
  const state = useRef(historyState);

  const onPop = useCallback(() => {
    // Back: the browser has already taken the entry away.
    entry.current = false;
    dialogRef.current?.close();
  }, []);

  /** Runs on every way out (Close, Esc, the backdrop, Back): one place undoes everything open() did. */
  const onClosed = useCallback(() => {
    window.removeEventListener("popstate", onPop);
    document.documentElement.classList.remove(MODAL_OPEN_CLASS);
    if (entry.current) {
      entry.current = false;
      // The popstate this causes lands on the section entry, which section-history ignores.
      window.history.back();
    }
    if (returnFocus.current) opener.current?.focus();
    returnFocus.current = true;
  }, [onPop]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    dialog.addEventListener("close", onClosed);
    return () => {
      dialog.removeEventListener("close", onClosed);
      // Unmounted while open (the screen changed): leave no entry and no lock behind.
      window.removeEventListener("popstate", onPop);
      document.documentElement.classList.remove(MODAL_OPEN_CLASS);
      if (entry.current) {
        entry.current = false;
        window.history.back();
      }
    };
  }, [onClosed, onPop]);

  const open = useCallback((from?: HTMLElement | null) => {
    const dialog = dialogRef.current;
    if (dialog === null || dialog.open) return;
    // Safari does not focus a button on click, so the caller says which control opened it.
    opener.current = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    returnFocus.current = true;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    document.documentElement.classList.add(MODAL_OPEN_CLASS);
    window.history.pushState(state.current, "");
    entry.current = true;
    window.addEventListener("popstate", onPop);
    closeRef.current?.focus();
  }, [onPop]);

  const close = useCallback(
    (options?: { returnFocus?: boolean }) => {
      const dialog = dialogRef.current;
      if (dialog === null) return;
      returnFocus.current = options?.returnFocus !== false;
      if (typeof dialog.close === "function" && typeof dialog.showModal === "function") dialog.close();
      else {
        // Browsers without <dialog> support: close by hand and run the same clean-up.
        dialog.removeAttribute("open");
        onClosed();
      }
    },
    [onClosed]
  );

  const onDialogClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === event.currentTarget) close();
    },
    [close]
  );

  return { dialogRef, closeRef, open, close, onDialogClick };
}
