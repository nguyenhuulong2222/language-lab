/**
 * The steps of the session on screen (setup, parts, report). The take counter in the screen
 * headers counts within them: a one-part session says TAKE 01, not TAKE 05.
 */
import { createContext, useContext } from "react";
import type { SessionStage } from "../contracts";
import { STAGE_ORDER } from "./stages";

export const SessionStepsContext = createContext<readonly SessionStage[]>(STAGE_ORDER);

export function useSessionSteps(): readonly SessionStage[] {
  return useContext(SessionStepsContext);
}
