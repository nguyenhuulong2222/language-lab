/**
 * App footer: the standing disclaimer, always visible.
 */
import { Disclaimer, DISCLAIMER_SHORT } from "./Disclaimer";
import "./Footer.css";

export function Footer() {
  return (
    <footer className="footer">
      <div className="ll-container footer__inner">
        <Disclaimer text={DISCLAIMER_SHORT} />
      </div>
    </footer>
  );
}
