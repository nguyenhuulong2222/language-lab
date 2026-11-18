/**
 * Plays a prompt aloud and says which voice it is: "AI-generated voice" when a pre-generated
 * clip plays, "Device voice" only when the browser's own voice is used instead. Tapping while
 * it plays stops it; tapping again plays it from the start. When nothing can speak, the text on
 * screen is the prompt and a note says so.
 *
 * Playback starts inside the click handler (iPhone Safari needs a tap).
 */
import { useEffect, useMemo, useState } from "react";
import type { MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { useSpeaker } from "../voice/VoiceProvider";

interface SpeakButtonProps {
  text: string;
  /** Id of the pre-generated clip for this text. Without one, only the device voice can speak it. */
  clipId?: string;
  /** Message key of the button label. Default: "Play aloud". */
  labelKey?: MessageKey;
}

export function SpeakButton({ text, clipId, labelKey = "audio.play" }: SpeakButtonProps) {
  const t = useT();
  const speaker = useSpeaker();
  const prompt = useMemo(() => (clipId === undefined ? { text } : { text, clipId }), [text, clipId]);
  const [playing, setPlaying] = useState(false);
  const [fellBack, setFellBack] = useState(false);

  useEffect(() => () => speaker.cancel(), [speaker]);

  const planned = speaker.voiceFor(prompt);
  if (planned === null) {
    return <p className="note">{t("audio.unavailable")}</p>;
  }
  const voice = fellBack ? "device-voice" : planned;

  const play = () => {
    setFellBack(false);
    setPlaying(true);
    speaker
      .speak(prompt, { onFallback: () => setFellBack(true) })
      .catch(() => {})
      .finally(() => setPlaying(false));
  };

  const stop = () => {
    speaker.cancel();
    setPlaying(false);
  };

  return (
    <div className="speak">
      <button type="button" className="btn btn--secondary" onClick={playing ? stop : play}>
        {playing ? t("audio.stop") : t(labelKey)}
      </button>
      <p className="note">{voice === "recording" ? t("audio.aiVoice") : t("audio.deviceVoice")}</p>
    </div>
  );
}
