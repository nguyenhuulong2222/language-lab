/**
 * Plays a prompt aloud and says which voice it is: "AI-generated voice" when a pre-generated
 * clip plays, "Device voice" only when the browser's own voice is used instead. Tapping while
 * it plays stops it. Once it has played, "Play again" starts it from the beginning. The comfort
 * setting "slower playback" changes the speed of the same recording.
 *
 * Playback starts inside the click handler (iPhone Safari needs a tap).
 */
import { useEffect, useMemo, useState } from "react";
import type { MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { useSettings } from "../settings";
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
  const { slowPlayback } = useSettings();
  const prompt = useMemo(() => (clipId === undefined ? { text } : { text, clipId }), [text, clipId]);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);
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
    setPlayed(true);
    speaker
      .speak(prompt, { onFallback: () => setFellBack(true), slow: slowPlayback })
      .catch(() => {})
      .finally(() => setPlaying(false));
  };

  const stop = () => {
    speaker.cancel();
    setPlaying(false);
  };

  return (
    <div className="speak">
      <div className="btn-row">
        <button type="button" className="btn btn--secondary" onClick={playing ? stop : play}>
          {playing ? t("audio.stop") : t(labelKey)}
        </button>
        {played && (
          <button type="button" className="btn btn--secondary" onClick={play}>
            {t("audio.again")}
          </button>
        )}
      </div>
      <p className="note">{voice === "recording" ? t("audio.aiVoice") : t("audio.deviceVoice")}</p>
    </div>
  );
}
