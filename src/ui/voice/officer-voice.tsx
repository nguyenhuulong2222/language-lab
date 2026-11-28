/**
 * The officer voice of the current practice (decisions log T). PracticeApp picks it from the
 * practice's seed when the practice starts (or once per Study first visit) and keeps it until
 * Home or restart; the comfort setting "Always the same voice" keeps officer-a. Speak buttons read
 * it here. In memory only, like the other comfort settings.
 */
import { createContext, useContext, type ReactNode } from "react";
import type { OfficerVoiceId } from "../../engine/audio-clips";

const OfficerVoiceContext = createContext<OfficerVoiceId>("officer-a");

export function OfficerVoiceProvider({ voice, children }: { voice: OfficerVoiceId; children: ReactNode }) {
  return <OfficerVoiceContext.Provider value={voice}>{children}</OfficerVoiceContext.Provider>;
}

/** The officer voice the speak buttons use now. officer-a outside a practice. */
export function useOfficerVoice(): OfficerVoiceId {
  return useContext(OfficerVoiceContext);
}
