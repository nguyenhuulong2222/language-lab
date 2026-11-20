/**
 * Gives screens the speaker and the listener. Real browser versions by default: pre-generated
 * MP3 clips (from the manifest that ships with the app) with the device voice as the fallback.
 * A test passes its own.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { parseManifest } from "../../engine/audio-clips";
import MANIFEST from "../../../public/audio/manifest.json" with { type: "json" };
import {
  createDeviceVoiceSpeaker,
  createMp3PromptSpeaker,
  SILENT_SPEAKER,
  type PromptSpeaker,
} from "./prompt-speaker";
import { createBrowserSpeechListener, UNSUPPORTED_LISTENER, type SpeechListener } from "./speech-listener";
import { createSelfReviewRecorder, UNSUPPORTED_RECORDER, type SelfReviewRecorder } from "./self-review";

interface VoiceValue {
  speaker: PromptSpeaker;
  listener: SpeechListener;
  recorder: SelfReviewRecorder;
}

/** Without a provider (server rendering, tests) nothing speaks and nothing listens. */
const VoiceContext = createContext<VoiceValue>({ speaker: SILENT_SPEAKER, listener: UNSUPPORTED_LISTENER, recorder: UNSUPPORTED_RECORDER });

export function createDefaultSpeaker(): PromptSpeaker {
  return createMp3PromptSpeaker({
    manifest: parseManifest(MANIFEST),
    fallback: createDeviceVoiceSpeaker(),
  });
}

export function VoiceProvider({
  speaker,
  listener,
  recorder,
  children,
}: {
  speaker?: PromptSpeaker;
  listener?: SpeechListener;
  recorder?: SelfReviewRecorder;
  children: ReactNode;
}) {
  const value = useMemo<VoiceValue>(
    () => ({
      speaker: speaker ?? createDefaultSpeaker(),
      listener: listener ?? createBrowserSpeechListener(),
      recorder: recorder ?? createSelfReviewRecorder(),
    }),
    [speaker, listener, recorder]
  );
  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useSpeaker(): PromptSpeaker {
  return useContext(VoiceContext).speaker;
}

export function useListener(): SpeechListener {
  return useContext(VoiceContext).listener;
}

/** The self-review recorder (listen-and-compare). Unsupported without a provider. */
export function useRecorder(): SelfReviewRecorder {
  return useContext(VoiceContext).recorder;
}
