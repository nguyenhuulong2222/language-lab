/**
 * True while the practice is not in front of the learner: the Credits screen is open, or the browser
 * tab is in the background. The practice stays mounted so typed answers are kept, but the
 * microphone, the speech recogniser and the audio must not keep running (audit SEC-04).
 */
import { createContext, useContext } from "react";
export const PracticeHiddenContext = createContext(false);
export function usePracticeHidden(): boolean {
  return useContext(PracticeHiddenContext);
}
