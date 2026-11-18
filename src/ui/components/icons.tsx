/**
 * Small inline icon set. All icons are decorative: callers must pair them with
 * a text label (visible or screen-reader-only) so status never relies on the
 * icon or its color alone.
 */

interface IconProps {
  className?: string;
}

/** A check mark — used for "on track" / "completed" status. */
export function CheckIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A bookmark/flag — used for "review this" status (encouraging, not punitive). */
export function ReviewIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7 4.5h10v15l-5-3-5 3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A globe: marks the language menu button. Always paired with the language's name. */
export function GlobeIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
