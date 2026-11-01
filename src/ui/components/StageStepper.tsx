/**
 * Stage progress indicator for the practice interview. Shows the five stages
 * plus the report, in order, with the current stage highlighted.
 *
 * Accessibility: status is conveyed by a check icon (completed), a filled
 * marker + aria-current (current), or a number (upcoming), each paired with a
 * screen-reader-only status word — never by color alone.
 *
 * Mobile shows a condensed "Stage N of M" line plus a progress bar; desktop
 * shows the full numbered stepper. Exactly one is in the accessibility tree per
 * breakpoint.
 */
import type { SessionStage } from "../../contracts";
import type { StageMeta } from "../stages";
import { stageIndex } from "../stages";
import { CheckIcon } from "./icons";
import "./StageStepper.css";

interface StageStepperProps {
  stages: readonly StageMeta[];
  currentStage: SessionStage;
}

type StepStatus = "complete" | "current" | "upcoming";

const STATUS_WORD: Record<StepStatus, string> = {
  complete: "completed",
  current: "current step",
  upcoming: "upcoming",
};

export function StageStepper({ stages, currentStage }: StageStepperProps) {
  const currentIndex = stageIndex(currentStage);

  const steps = stages.map((s, i): { meta: StageMeta; status: StepStatus } => {
    const status: StepStatus =
      i < currentIndex ? "complete" : i === currentIndex ? "current" : "upcoming";
    return { meta: s, status };
  });

  const progressPct = ((currentIndex + 1) / stages.length) * 100;

  return (
    <nav className="stepper" aria-label="Interview stages">
      <div className="ll-container">
        {/* Condensed view (mobile) */}
        <p className="stepper__condensed">
          <span className="stepper__condensed-count">
            Stage {currentIndex + 1} of {stages.length}
          </span>
          <span className="stepper__condensed-sep" aria-hidden="true">
            ·
          </span>
          <span className="stepper__condensed-label">
            {stages[currentIndex].label}
          </span>
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
                <span className="stepper__step-label">{meta.short}</span>
                <span className="ll-sr-only">{STATUS_WORD[status]}</span>
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
