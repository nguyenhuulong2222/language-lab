/**
 * "← Back to Home" at the top of the main column on every screen except Home (Shell renders it).
 * 56px, secondary, an arrow and the words. In a practice with answers it asks first, with the
 * leave confirmation: "Keep practicing" (filled, first) and "Leave" (outlined), both full width.
 * In Study, setup and on reports it goes straight home.
 *
 * The confirmation is controlled by Shell, so the browser Back button can open the same one.
 */
import { useEffect, useId, useRef } from "react";
import { useT } from "../../i18n/react";
import { ArrowLeftIcon } from "./icons";

interface BackToHomeProps {
  onHome: () => void;
  /** Ask before leaving (a practice with answers that would be lost). */
  confirm: boolean;
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
}

export function BackToHome({ onHome, confirm, confirmOpen, setConfirmOpen }: BackToHomeProps) {
  const t = useT();
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  // Opening the confirmation moves focus to it; closing it puts focus back on the button.
  useEffect(() => {
    if (confirmOpen) panel.current?.focus();
    else if (wasOpen.current) button.current?.focus();
    wasOpen.current = confirmOpen;
  }, [confirmOpen]);
  const open = confirm && confirmOpen;
  return (
    <div className="back-home">
      <button
        type="button"
        ref={button}
        className="btn btn--secondary back-home__button"
        {...(confirm ? { "aria-expanded": open, "aria-controls": panelId } : {})}
        onClick={() => (confirm ? setConfirmOpen(!confirmOpen) : onHome())}
      >
        <ArrowLeftIcon className="back-home__icon" />
        <span>{t("report.home")}</span>
      </button>
      {confirm && (
        <div
          id={panelId}
          ref={panel}
          tabIndex={-1}
          role="region"
          aria-label={t("report.home")}
          className="panel back-home__confirm"
          hidden={!open}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setConfirmOpen(false);
            }
          }}
        >
          <p>{t("header.homeConfirm")}</p>
          {/* Staying is the main action: "Keep practicing" first and filled, "Leave" outlined, both full width. */}
          <div className="btn-row btn-row--stack">
            <button type="button" className="btn btn--primary" onClick={() => setConfirmOpen(false)}>
              {t("header.homeConfirm.no")}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setConfirmOpen(false);
                onHome();
              }}
            >
              {t("header.homeConfirm.yes")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
