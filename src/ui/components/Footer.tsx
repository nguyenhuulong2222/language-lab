/**
 * App footer: the standing disclaimer, always visible.
 */
import { Disclaimer } from "./Disclaimer";
import "./Footer.css";

export function Footer() {
  return (
    <footer className="footer">
      <div className="ll-container footer__inner">
        <Disclaimer messageKey="disclaimer.short" />
      </div>
    </footer>
  );
}
