/**
 * Plays a prompt aloud and says which voice it is: "AI-generated voice" when a pre-generated
 * clip plays, "Device voice" only when the browser's own voice is used instead. Tapping while
 * it plays stops it. Once it has played, "Play again" starts it from the beginning. The comfort
 * setting "slower playback" changes the speed of the same recording.
 *
 * Playback starts inside the click handler (iPhone Safari needs a tap).
 */
import { useEffect, useMemo, useRef, useState } from "react";
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
  /** Called when the prompt could not be played at all (after the device voice was tried). */
  onFailed?: () => void;
}

export function SpeakButton({ text, clipId, labelKey = "audio.play", onFailed }: SpeakButtonProps) {
  const t = useT();
  const speaker = useSpeaker();
  const { slowPlayback } = useSettings();
  const prompt = useMemo(() => (clipId === undefined ? { text } : { text, clipId }), [text, clipId]);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);
  const [fellBack, setFellBack] = useState(false);
  const [failed, setFailed] = useState(false);
  // Each play gets a number, so a clip that was cut off by "Play again" cannot reset the button of the new one.
  const run = useRef(0);

  useEffect(() => () => speaker.cancel(), [speaker]);

  const planned = speaker.voiceFor(prompt);
  if (planned === null) {
    return <p className="note">{t("audio.unavailable")}</p>;
  }
  const voice = fellBack ? "device-voice" : planned;

  const play = () => {
    const mine = ++run.current;
    setFellBack(false);
    setFailed(false);
    setPlaying(true);
    setPlayed(true);
    speaker
      .speak(prompt, {
        onFallback: () => setFellBack(true),
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
      {/* Always in the page, so a screen reader announces the text when it appears. */}
      <p className={failed ? "status status--attention" : "ll-sr-only"} role="status">
        {failed ? t("audio.failed") : ""}
      </p>
    </div>
  );
}
