/**
 * Plays a prompt aloud and says which voice it is: "AI-generated voice" when a pre-generated
 * clip plays, "Built-in voice" only when the browser's own voice is used instead. Large by default
 * ("Play the question", 64px). While it plays, the line under it says "Playing…" and the button
 * says "Stop". "Play again" is always next to it and starts from the beginning. Nothing plays by
 * itself. The comfort setting "slower voice" changes the speed of the same recording. The voice is
 * the officer of this practice (useOfficerVoice); a sample answer always keeps officer-a's clip.
 *
 * Playback starts inside the click handler (iPhone Safari needs a tap).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { OfficerVoiceId } from "../../engine/audio-clips";
import type { MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { useSettings } from "../settings";
import { useOfficerVoice } from "../voice/officer-voice";
import { useSpeaker } from "../voice/VoiceProvider";
import { ReviewIcon } from "./icons";

/** The voice line when a recording plays: it names the officer whose clip it is. */
const OFFICER_LINE: Record<OfficerVoiceId, MessageKey> = {
  "officer-a": "audio.aiVoice.officer1",
  "officer-b": "audio.aiVoice.officer2",
  "officer-c": "audio.aiVoice.officer3",
};

interface SpeakButtonProps {
  text: string;
  /** Id of the pre-generated clip for this text. Without one, only the device voice can speak it. */
  clipId?: string;
  /** Message key of the button label. Default: "Play aloud". */
  labelKey?: MessageKey;
  /** Called when the prompt could not be played at all (after the device voice was tried). */
  onFailed?: () => void;
  /** The large 64px player for the main prompt. Default true; false for sample answers. */
  large?: boolean;
  /** The text holds the learner's own name: only a voice on this device may speak it (see SpokenPrompt.localOnly). */
  localOnly?: boolean;
}

export function SpeakButton({ text, clipId, labelKey = "audio.play", onFailed, large = true, localOnly = false }: SpeakButtonProps) {
  const t = useT();
  const speaker = useSpeaker();
  const { slowPlayback } = useSettings();
  const officer = useOfficerVoice();
  const prompt = useMemo(
    () => ({
      text,
      ...(clipId === undefined ? {} : { clipId }),
      ...(localOnly ? { localOnly: true } : {}),
      ...(officer === "officer-a" ? {} : { officer }),
    }),
    [text, clipId, localOnly, officer]
  );
  const [playing, setPlaying] = useState(false);
  const [fellBack, setFellBack] = useState(false);
  // Set when another officer's clip took over during play (the chosen voice's clip did not load).
  const [playedOfficer, setPlayedOfficer] = useState<OfficerVoiceId | null>(null);
  const [failed, setFailed] = useState(false);
  // Each play gets a number, so a clip that was cut off by "Play again" cannot reset the button of the new one.
  const run = useRef(0);

  useEffect(() => () => speaker.cancel(), [speaker]);

  const planned = speaker.voiceFor(prompt);
  if (planned === null) {
    return <p className="note">{t("audio.unavailable")}</p>;
  }
  const voice = fellBack ? "device-voice" : planned;
  const officerShown = playedOfficer ?? speaker.officerFor?.(prompt) ?? null;

  const play = () => {
    const mine = ++run.current;
    setFellBack(false);
    setPlayedOfficer(null);
    setFailed(false);
    setPlaying(true);
    speaker
      .speak(prompt, {
        onFallback: () => setFellBack(true),
        onOfficer: (v) => setPlayedOfficer(v),
        slow: slowPlayback,
        onFailed: () => {
          setFailed(true);
          onFailed?.();
        },
      })
      .catch(() => {})
      .finally(() => {
        if (run.current === mine) setPlaying(false);
      });
  };

  const stop = () => {
    run.current++;
    speaker.cancel();
    setPlaying(false);
  };

  return (
    <div className="speak">
      <div className="btn-row">
        <button type="button" className={large ? "btn btn--secondary btn--large" : "btn btn--secondary"} onClick={playing ? stop : play}>
          {playing ? t("audio.stop") : t(labelKey)}
        </button>
        <button type="button" className={large ? "btn btn--secondary btn--large" : "btn btn--secondary"} onClick={play}>
          {t("audio.again")}
        </button>
      </div>
      <p className="speak__state" role="status">
        {playing ? t("audio.playing") : ""}
      </p>
      <p className="note">
        {voice !== "recording" ? t("audio.deviceVoice") : officerShown !== null ? t(OFFICER_LINE[officerShown]) : t("audio.aiVoice")}
      </p>
      {/* Always in the page, so a screen reader announces the text when it appears. */}
      <p className={failed ? "status status--attention" : "ll-sr-only"} role="status">
        {failed && <ReviewIcon className="icon-inline icon-inline--attention" />}
        {failed ? ` ${t("audio.failed")}` : ""}
      </p>
    </div>
  );
}
