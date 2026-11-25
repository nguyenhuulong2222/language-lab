/**
 * Stage progress indicator for the practice interview. Shows the five stages
 * plus the report, in order, with the current stage highlighted.
 *
 * Accessibility: status is conveyed by a check icon (completed), a filled
 * marker + aria-current (current), or a number (upcoming), each paired with a
 * screen-reader-only status word — never by color alone.
 *
 * Mobile shows one plain line, "Step N of M: name", plus a progress bar; desktop
 * shows the full numbered stepper. Exactly one is in the accessibility tree per
 * breakpoint.
 */
import type { SessionStage } from "../../contracts";
import type { StageMeta } from "../stages";
import { CheckIcon } from "./icons";
import { useT } from "../../i18n/react";
import type { MessageKey } from "../../i18n";
import "./StageStepper.css";

interface StageStepperProps {
  stages: readonly StageMeta[];
  currentStage: SessionStage;
}

type StepStatus = "complete" | "current" | "upcoming";

const STATUS_WORD: Record<StepStatus, MessageKey> = {
  complete: "stepper.status.complete",
  current: "stepper.status.current",
  upcoming: "stepper.status.upcoming",
};

export function StageStepper({ stages, currentStage }: StageStepperProps) {
  const t = useT();
  const currentIndex = Math.max(
    0,
    stages.findIndex((s) => s.stage === currentStage)
  );

  const steps = stages.map((s, i): { meta: StageMeta; status: StepStatus } => {
    const status: StepStatus =
      i < currentIndex ? "complete" : i === currentIndex ? "current" : "upcoming";
    return { meta: s, status };
  });

  const progressPct = ((currentIndex + 1) / stages.length) * 100;

  return (
    <nav className="stepper" aria-label={t("stepper.label")}>
      <div className="ll-container">
        {/* Condensed view (mobile) */}
        {/* One plain line: "Step 3 of 6: Reading". It wraps on a narrow screen instead of shrinking. */}
        <p className="stepper__condensed">
          {t("stepper.count", { current: currentIndex + 1, total: stages.length, name: t(stages[currentIndex]!.labelKey) })}
        </p>
        <div
          className="stepper__bar"
          role="presentation"
          aria-hidden="true"
        >
          <div
            className="stepper__bar-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Full view (desktop) */}
        <ol className="stepper__list">
          {steps.map(({ meta, status }, i) => (
            <li
              key={meta.stage}
              className={`stepper__step stepper__step--${status}`}
              aria-current={status === "current" ? "step" : undefined}
            >
              <span
                className="stepper__connector stepper__connector--lead"
                aria-hidden="true"
              />
              <span className="stepper__node">
                <span className="stepper__marker" aria-hidden="true">
                  {status === "complete" ? (
                    <CheckIcon className="stepper__marker-icon" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="stepper__step-label">{t(meta.shortKey)}</span>
                <span className="ll-sr-only">{t(STATUS_WORD[status])}</span>
              </span>
              <span
                className="stepper__connector stepper__connector--trail"
                aria-hidden="true"
              />
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
