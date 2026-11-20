/**
 * Answer by voice with a typed fallback. The text box is always there and always works.
 * "Say it" asks the browser to listen; whatever it hears is put into the text box so the
 * user can read and fix it before sending. Every outcome has a message: heard, nothing heard,
 * microphone blocked, no microphone, browser cannot listen, other error.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { InputMode } from "../../engine/practice-flow";
import type { VoiceOutcome } from "../../engine/recognition-outcome";
import { useT } from "../../i18n/react";
import { ReviewIcon } from "./icons";
import type { MessageKey } from "../../i18n";
import { useListener } from "../voice/VoiceProvider";

interface AnswerInputProps {
  /** Visible label of the text box. */
  label: string;
  submitLabel: string;
  /** Offer "Say it". Writing turns this off. */
  voice: boolean;
  /** Offer "Skip this one", which sends an empty answer. */
  allowSkip?: boolean;
  /** `alternatives` are the other ways the recogniser heard the speech, only when the text was not edited. */
  onSubmit: (text: string, input: InputMode, alternatives?: readonly string[]) => void;
}

const MESSAGE: Record<Exclude<VoiceOutcome["kind"], "transcript">, MessageKey> = {
  denied: "voice.denied",
  unsupported: "voice.unsupported",
  "nothing-heard": "voice.nothingHeard",
  "no-microphone": "voice.noMicrophone",
  error: "voice.error",
};

export function AnswerInput({ label, submitLabel, voice, allowSkip = false, onSubmit }: AnswerInputProps) {
  const t = useT();
  const listener = useListener();
  const inputId = useId();
  const statusId = useId();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(
    voice && !listener.supported ? "voice.unsupported" : null
  );
  const heard = useRef<string | null>(null);
  const heardAlternatives = useRef<readonly string[]>([]);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => listener.stop(), [listener]);

  const listen = () => {
    setMessage("voice.listening");
    setListening(true);
    void listener.listen().then((outcome) => {
      setListening(false);
      if (outcome.kind === "transcript") {
        heard.current = outcome.text;
        heardAlternatives.current = outcome.alternatives;
        setText(outcome.text);
        setMessage("voice.heard");
      } else {
        setMessage(MESSAGE[outcome.kind]);
      }
    });
  };

  const submit = () => {
    if (text.trim() === "") {
      setMessage("voice.needText");
      box.current?.focus();
      return;
    }
    send(text.trim());
  };

  const send = (value: string) => {
    // Alternatives are used only for text that came from the recogniser and was not edited.
    const spoken = heard.current !== null && heard.current === value;
    if (spoken) onSubmit(value, "voice", heardAlternatives.current);
    else onSubmit(value, "typed");
  };

  const canListen = voice && listener.supported;
  const needsAttention =
    message !== null && message !== "voice.listening" && message !== "voice.heard" && message !== "voice.unsupported";

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <textarea
        id={inputId}
        ref={box}
        className="field__input"
        value={text}
        rows={3}
        autoCapitalize="off"
        autoComplete="off"
        spellCheck={false}
        aria-describedby={statusId}
        onChange={(event) => {
          setText(event.target.value);
          setMessage((current) => (current === "voice.needText" ? null : current));
        }}
      />
      <p id={statusId} className={needsAttention ? "status status--attention" : "status"} role="status" aria-live="polite">
        {needsAttention && <ReviewIcon className="icon-inline icon-inline--attention" />}
        {needsAttention && " "}
        {message === null ? "" : t(message)}
      </p>
      <div className="btn-row">
        {canListen && (
          <button
            type="button"
            className={listening ? "btn btn--active" : "btn btn--secondary"}
            onClick={listening ? () => listener.stop() : listen}
          >
            {listening ? t("voice.stop") : t("voice.say")}
          </button>
        )}
        <button type="button" className="btn" onClick={submit}>
          {submitLabel}
        </button>
        {allowSkip && (
          <button type="button" className="btn btn--secondary" onClick={() => send("")}>
            {t("voice.skip")}
          </button>
        )}
      </div>
    </div>
  );
}
