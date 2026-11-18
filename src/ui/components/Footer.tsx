/**
 * App footer: the standing disclaimer, always visible.
 */
import { Disclaimer } from "./Disclaimer";
import { useT } from "../../i18n/react";
import "./Footer.css";

export function Footer() {
  const t = useT();
  return (
    <footer className="footer">
      <div className="ll-container footer__inner">
        <Disclaimer text={t("disclaimer.short")} />
      </div>
    </footer>
  );
}
