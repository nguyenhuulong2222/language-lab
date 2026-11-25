/**
 * Screen opening: the H1 and an optional lead. The tape-counter overline ("TAKE 03 · READING") was
 * removed for older learners: the stepper above says "Step 3 of 6: Reading" in plain words. The
 * heading takes focus when `focusKey` changes, so screen readers start at the new content.
 */
import { useEffect, useRef, type ReactNode } from "react";
import type { SessionStage } from "../../contracts";
import "./Screen.css";

interface TakeHeaderProps {
  /** The stage, or "home" for the home screen (kept as a data attribute for styling and tests). */
  stage: SessionStage | "home";
  title: string;
  lead?: ReactNode;
  /**
   * The heading takes focus whenever this value changes (a new question, a new screen), so
   * keyboard and screen-reader users start at the new content. null: do not move focus (the
   * screen moves it somewhere else itself).
   */
  focusKey?: string | number | null;
  /** Move focus when the page first appears. Off on the very first screen, so the skip link stays first. */
  focusOnFirstRender?: boolean;
}

export function TakeHeader({ stage, title, lead, focusKey = "screen", focusOnFirstRender = true }: TakeHeaderProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  // Reset when the component goes away. Strict Mode's extra unmount/mount in development then
  // still counts as the first render.
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  useEffect(() => {
    const isFirstRender = !mounted.current;
    mounted.current = true;
    if (focusKey === null || (isFirstRender && !focusOnFirstRender)) return;
    heading.current?.focus();
  }, [focusKey, focusOnFirstRender]);

  return (
    <header className="take" data-stage={stage}>
      
      <h1 className="take__title" ref={heading} tabIndex={-1}>
        {title}
      </h1>
      {lead !== undefined && <p className="take__lead">{lead}</p>}
    </header>
  );
}
