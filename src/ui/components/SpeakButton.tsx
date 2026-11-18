/**
 * Plays a prompt aloud through the PromptSpeaker and says which kind of voice it is. When the
 * browser cannot speak, it says so and the text on screen is the prompt.
 */
import { useEffect, useState } from "react";
import { useT } from "../../i18n/react";
import { useSpeaker } from "../voice/VoiceProvider";

export function SpeakButton({ text }: { text: string }) {
  const t = useT();
  const speaker = useSpeaker();
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => speaker.cancel(), [speaker]);

  if (!speaker.available) {
    return <p className="note">{t("audio.unavailable")}</p>;
  }

  const play = () => {
    setPlaying(true);
    speaker
      .speak(text)
      .catch(() => {})
      .finally(() => setPlaying(false));
  };

  const stop = () => {
    speaker.cancel();
    setPlaying(false);
  };

  return (
    <div className="speak">
      <button
        type="button"
        className="btn btn--secondary"
        onClick={playing ? stop : play}
      >
        {playing ? t("audio.stop") : t("audio.play")}
      </button>
      {speaker.kind === "device-voice" && <p className="note">{t("audio.deviceVoice")}</p>}
    </div>
  );
}
