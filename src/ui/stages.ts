/**
 * Stage metadata for the practice interview.
 * The order matches the SessionStage flow defined in src/contracts/session.ts.
 */
import type { SessionStage } from "../contracts";
import type { MessageKey } from "../i18n";

export interface StageMeta {
  stage: SessionStage;
  /** Message key of the full label (used in headings and the mobile stepper). */
  labelKey: MessageKey;
  /** Message key of the compact label for the desktop stepper. */
  shortKey: MessageKey;
}

export const STAGES: readonly StageMeta[] = [
  { stage: "intro", labelKey: "stage.intro.label", shortKey: "stage.intro.short" },
  { stage: "n400_interview", labelKey: "stage.n400_interview.label", shortKey: "stage.n400_interview.short" },
  { stage: "reading", labelKey: "stage.reading.label", shortKey: "stage.reading.short" },
  { stage: "writing", labelKey: "stage.writing.label", shortKey: "stage.writing.short" },
  { stage: "civics", labelKey: "stage.civics.label", shortKey: "stage.civics.short" },
  { stage: "report", labelKey: "stage.report.label", shortKey: "stage.report.short" },
] as const;

export const STAGE_ORDER: readonly SessionStage[] = STAGES.map((s) => s.stage);

export function stageIndex(stage: SessionStage): number {
  const i = STAGE_ORDER.indexOf(stage);
  return i === -1 ? 0 : i;
}

/** The stage metadata for a list of steps, in that order (the stepper of one session). */
export function metaForSteps(steps: readonly SessionStage[]): StageMeta[] {
  return steps.map((step) => STAGES[stageIndex(step)]!);
}
