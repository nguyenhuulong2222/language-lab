/**
 * App footer: the standing disclaimer, always visible; "About & disclaimer" as a big button that
 * opens the full disclaimer and the AI coach privacy note below it; and the picture credits.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useT } from "../../i18n/react";
import { Disclaimer } from "./Disclaimer";
import { LegalText } from "./LegalText";
import "./Footer.css";
export function Footer({ onCredits, creditsOpen = false }: { onCredits?: (opener: HTMLElement) => void; creditsOpen?: boolean }) {
  const t = useT();
  const aboutId = useId();
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutButton = useRef<HTMLButtonElement>(null);
  const aboutPanel = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (aboutOpen) aboutPanel.current?.focus();
    else if (wasOpen.current) aboutButton.current?.focus();
    wasOpen.current = aboutOpen;
  }, [aboutOpen]);
  return (
    <footer className="footer">
      <div className="ll-container footer__inner">
        <Disclaimer messageKey="disclaimer.short" />
        <button
          type="button"
          ref={aboutButton}
          className="btn btn--secondary footer__about"
          aria-expanded={aboutOpen}
          aria-controls={aboutId}
          onClick={() => setAboutOpen((open) => !open)}
        >
          {t("header.about")}
        </button>
        <div
          id={aboutId}
          ref={aboutPanel}
          tabIndex={-1}
          role="region"
          aria-label={t("header.about")}
          className="footer__panel"
          hidden={!aboutOpen}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setAboutOpen(false);
            }
          }}
        >
          <Disclaimer messageKey="disclaimer.full" />
          <p className="note">
            <LegalText messageKey="coach.privacy" />
          </p>
        </div>
        {onCredits !== undefined && (
          <button type="button" className="footer__link" aria-expanded={creditsOpen} onClick={(event) => onCredits(event.currentTarget)}>
            {t("footer.credits")}
          </button>
        )}
      </div>
    </footer>
  );
}
