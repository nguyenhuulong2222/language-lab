/**
 * Stage metadata for the practice interview.
 * The order matches the SessionStage flow defined in src/contracts/session.ts.
 */
import type { SessionStage } from "../contracts";

export interface StageMeta {
  stage: SessionStage;
  /** Full, human-readable label (used in headings and the mobile stepper). */
  label: string;
  /** Compact label for the desktop stepper. */
  short: string;
}

export const STAGES: readonly StageMeta[] = [
  { stage: "intro", label: "Welcome", short: "Intro" },
  { stage: "n400_interview", label: "N-400 conversation", short: "N-400" },
  { stage: "reading", label: "Reading", short: "Reading" },
  { stage: "writing", label: "Writing", short: "Writing" },
  { stage: "civics", label: "Civics", short: "Civics" },
  { stage: "report", label: "Practice report", short: "Report" },
] as const;

export const STAGE_ORDER: readonly SessionStage[] = STAGES.map((s) => s.stage);

export function stageIndex(stage: SessionStage): number {
  const i = STAGE_ORDER.indexOf(stage);
  return i === -1 ? 0 : i;
}
