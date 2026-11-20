/**
 * Screen opening: the tape-counter overline (TAKE 03 · READING) above the H1, as on the report.
 * The counter and separator are decorative; the stage name is announced. The heading takes
 * focus when `focusKey` changes, so screen readers start at the new content.
 */
import { useEffect, useRef, type ReactNode } from "react";
import type { SessionStage } from "../../contracts";
import { useT } from "../../i18n/react";
import { useSessionSteps } from "../session-steps";
import { STAGES, stageIndex } from "../stages";
import "./Screen.css";

interface TakeHeaderProps {
  /** The stage, or "home" for the home screen (no take counter). */
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
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const steps = useSessionSteps();
  const found = stage === "home" ? 0 : steps.indexOf(stage);
  const position = found === -1 && stage !== "home" ? stageIndex(stage) : found;
  const take = String(position + 1).padStart(2, "0");

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
    <header className="take">
      {stage !== "home" && (
        <p className="take__overline">
          <span className="take__number" aria-hidden="true">
            {t("report.take")} {take}
          </span>
          <span className="take__sep" aria-hidden="true">
            ·
          </span>
          <span>{t(STAGES[stageIndex(stage)]!.labelKey)}</span>
        </p>
      )}
      <h1 className="take__title" ref={heading} tabIndex={-1}>
        {title}
      </h1>
      {lead !== undefined && <p className="take__lead">{lead}</p>}
    </header>
  );
}
