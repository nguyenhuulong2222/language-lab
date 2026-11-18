/**
 * Screen opening: the tape-counter overline (TAKE 03 · READING) above the H1, as on the report.
 * The counter and separator are decorative; the stage name is announced. The heading takes
 * focus when the screen appears, so screen readers start at the new screen.
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
}

export function TakeHeader({ stage, title, lead }: TakeHeaderProps) {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  const index = stageIndex(stage);
  const take = String(index + 1).padStart(2, "0");

  useEffect(() => {
    heading.current?.focus();
  }, []);

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
