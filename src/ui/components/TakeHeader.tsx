/**
 * Screen opening: the tape-counter overline (TAKE 03 · READING) above the H1, as on the report.
 * The counter and separator are decorative; the stage name is announced. The heading takes
 * focus when `focusKey` changes, so screen readers start at the new content.
 */
import { useEffect, useRef } from "react";
import type { SessionStage } from "../../contracts";
import { useT } from "../../i18n/react";
import { STAGES, stageIndex } from "../stages";
import "./Screen.css";

interface TakeHeaderProps {
  stage: SessionStage;
  title: string;
  lead?: string;
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
  const first = useRef(true);
  const index = stageIndex(stage);
  const take = String(index + 1).padStart(2, "0");

  useEffect(() => {
    const wasFirst = first.current;
    first.current = false;
    if (focusKey === null || (wasFirst && !focusOnFirstRender)) return;
    heading.current?.focus();
  }, [focusKey, focusOnFirstRender]);

  return (
    <header className="take">
      <p className="take__overline">
        <span className="take__number" aria-hidden="true">
          {t("report.take")} {take}
        </span>
        <span className="take__sep" aria-hidden="true">
          ·
        </span>
        <span>{t(STAGES[index]!.labelKey)}</span>
      </p>
      <h1 className="take__title" ref={heading} tabIndex={-1}>
        {title}
      </h1>
      {lead !== undefined && <p className="take__lead">{lead}</p>}
    </header>
  );
}
