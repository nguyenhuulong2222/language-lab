/**
 * App header: brand mark with a restrained reel glyph, and an accessible
 * "About & disclaimer" disclosure. The standing disclaimer is always one
 * tap/keypress away.
 */
import {
  Disclaimer,
  DISCLAIMER_FULL,
} from "./Disclaimer";
import "./Header.css";

export function Header() {
  return (
    <header className="header">
      <div className="ll-container header__inner">
        <div className="header__brand">
          <svg
            className="header__reel"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <circle cx="12" cy="12" r="3.4" fill="currentColor" />
          </svg>
          <span className="header__brand-name">Language Lab</span>
        </div>

        <details className="header__about">
          <summary className="header__about-summary">
            <span className="header__about-label">About &amp; disclaimer</span>
            <svg
              className="header__about-chevron"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </summary>
          <div className="header__about-panel">
            <Disclaimer text={DISCLAIMER_FULL} />
          </div>
        </details>
      </div>
    </header>
  );
}
