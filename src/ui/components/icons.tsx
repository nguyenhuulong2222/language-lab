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
