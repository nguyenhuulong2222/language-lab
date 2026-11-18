/**
 * Gives screens the speaker and the listener. Real browser versions by default; a test or a
 * later MP3-based speaker passes its own.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createDeviceVoiceSpeaker, SILENT_SPEAKER, type PromptSpeaker } from "./prompt-speaker";
import { createBrowserSpeechListener, UNSUPPORTED_LISTENER, type SpeechListener } from "./speech-listener";

interface VoiceValue {
  speaker: PromptSpeaker;
  listener: SpeechListener;
}

/** Without a provider (server rendering, tests) nothing speaks and nothing listens. */
const VoiceContext = createContext<VoiceValue>({ speaker: SILENT_SPEAKER, listener: UNSUPPORTED_LISTENER });

export function VoiceProvider({
  speaker,
  listener,
  children,
}: {
  speaker?: PromptSpeaker;
  listener?: SpeechListener;
  children: ReactNode;
}) {
  const value = useMemo<VoiceValue>(
    () => ({
      speaker: speaker ?? createDeviceVoiceSpeaker(),
      listener: listener ?? createBrowserSpeechListener(),
    }),
    [speaker, listener]
  );
  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useSpeaker(): PromptSpeaker {
  return useContext(VoiceContext).speaker;
}

export function useListener(): SpeechListener {
  return useContext(VoiceContext).listener;
}
