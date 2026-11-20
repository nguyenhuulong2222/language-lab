/**
 * App footer: the standing disclaimer, always visible, and a link to the picture credits.
 */
import { useT } from "../../i18n/react";
import { Disclaimer } from "./Disclaimer";
import "./Footer.css";

export function Footer({ onCredits, creditsOpen = false }: { onCredits?: (opener: HTMLElement) => void; creditsOpen?: boolean }) {
  const t = useT();
  return (
    <footer className="footer">
      <div className="ll-container footer__inner">
        <Disclaimer messageKey="disclaimer.short" />
        {onCredits !== undefined && (
          <button type="button" className="footer__link" aria-expanded={creditsOpen} onClick={(event) => onCredits(event.currentTarget)}>
            {t("footer.credits")}
          </button>
        )}
      </div>
    </footer>
  );
}
