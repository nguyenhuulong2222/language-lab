/**
 * The one "tap to go somewhere" component: a whole-card button with a title, one line, an optional
 * small line under it, and a visible verb with an arrow ("Start →"). It looks tappable (frame,
 * arrow, verb, hover and pressed states); plain text never looks like this.
 *
 * - `primary`: the screen's one filled main action (it carries `btn--primary`).
 * - `row`: a slimmer full-width row for lists ("Or practice one part").
 */
import { useId, type ReactNode, type Ref } from "react";
import { ArrowRightIcon } from "./icons";
import "./ActionCard.css";

interface ActionCardProps {
  title: ReactNode;
  text?: ReactNode;
  /** A smaller line under the text (attribution, "Not required for 65/20"). */
  meta?: ReactNode;
  /** The verb shown with the arrow. */
  verb: string;
  onClick: () => void;
  primary?: boolean;
  row?: boolean;
  /** Something after the title on the same line (the "AI" word badge). */
  badge?: ReactNode;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}

export function ActionCard({ title, text, meta, verb, onClick, primary = false, row = false, badge, className, ref }: ActionCardProps) {
  const titleId = useId();
  const textId = useId();
  const verbId = useId();
  const classes = ["action-card", primary ? "action-card--primary btn--primary" : "", row ? "action-card--row" : "", className ?? ""]
    .filter((c) => c !== "")
    .join(" ");
  return (
    <button
      type="button"
      ref={ref}
      className={classes}
      // The name is the title and the visible verb ("Reading, Start"), so speech control finds it.
      aria-labelledby={`${titleId} ${verbId}`}
      {...(text !== undefined || meta !== undefined ? { "aria-describedby": textId } : {})}
      onClick={onClick}
    >
      <span className="action-card__body">
        <span id={titleId} className="action-card__title">
          {title}
          {badge}
        </span>
        {(text !== undefined || meta !== undefined) && (
          <span id={textId} className="action-card__texts">
            {text !== undefined && <span className="action-card__text">{text}</span>}
            {meta !== undefined && <span className="action-card__meta">{meta}</span>}
          </span>
        )}
      </span>
      <span className="action-card__go">
        <span id={verbId}>{verb}</span>
        <ArrowRightIcon className="action-card__arrow" />
      </span>
    </button>
  );
}
