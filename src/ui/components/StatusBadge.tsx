/**
 * Small status chip. The label carries the meaning (never color alone); the
 * icon adds the status hue as a secondary cue. Text uses high-contrast ink on
 * a neutral chip so it stays readable in both themes.
 */
import { CheckIcon, ReviewIcon } from "./icons";
import "./StatusBadge.css";

type BadgeVariant = "positive" | "attention";

const ICONS = {
  positive: CheckIcon,
  attention: ReviewIcon,
} as const;

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

export function StatusBadge({ variant, label, className = "" }: StatusBadgeProps) {
  const Icon = ICONS[variant];
  return (
    <span className={`badge badge--${variant} ${className}`.trim()}>
      <Icon className="badge__icon" />
      <span className="badge__label">{label}</span>
    </span>
  );
}
