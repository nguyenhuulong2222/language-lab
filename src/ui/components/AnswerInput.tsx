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
import { usePracticeHidden } from "../practice-hidden";
import { useListener } from "../voice/VoiceProvider";
import { useHelpSeen } from "../help-session";
import { LegalText } from "./LegalText";

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
  /** Called when "Say it" starts, so another microphone user (the self-review recording) can stop. */
  onListenStart?: () => void;
}

const MESSAGE: Record<Exclude<VoiceOutcome["kind"], "transcript">, MessageKey> = {
  denied: "voice.denied",
  unsupported: "voice.unsupported",
  "nothing-heard": "voice.nothingHeard",
  "no-microphone": "voice.noMicrophone",
  error: "voice.error",
};

/** Key in the session memory (help-session.tsx): the voice notice was shown. */
const VOICE_NOTICE_KEY = "voice-notice";
export function AnswerInput({ label, submitLabel, voice, allowSkip = false, onSubmit, onListenStart }: AnswerInputProps) {
  const t = useT();
  const listener = useListener();
  const inputId = useId();
  const statusId = useId();
  const consentId = useId();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(
    voice && !listener.supported ? "voice.unsupported" : null
  );
  // Before the first "Say it" of a session: one notice that the browser may send the audio to its maker.
  const seen = useHelpSeen();
  const [consentOpen, setConsentOpen] = useState(false);
  const consentButton = useRef<HTMLButtonElement>(null);
  const voiceButton = useRef<HTMLButtonElement>(null);
  const heard = useRef<string | null>(null);
  const heardAlternatives = useRef<readonly string[]>([]);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => listener.stop(), [listener]);
  // Credits open or the tab in the background: the microphone must not stay on.
  const hidden = usePracticeHidden();
  useEffect(() => {
    if (hidden) listener.stop();
  }, [hidden, listener]);

  const startListening = () => {
    onListenStart?.();
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

  const listen = () => {
    if (!seen.has(VOICE_NOTICE_KEY)) {
      setConsentOpen(true);
      return;
    }
    startListening();
  };
  const continueWithVoice = () => {
    seen.add(VOICE_NOTICE_KEY);
    setConsentOpen(false);
    startListening();
    // The panel's button disappears: focus goes to the microphone button (now "Stop listening").
    setTimeout(() => voiceButton.current?.focus(), 0);
  };
  // Typing instead is not agreement: the notice is shown again before a later "Say it".
  const typeInstead = () => {
    setConsentOpen(false);
    box.current?.focus();
  };
  useEffect(() => {
    if (consentOpen) consentButton.current?.focus();
  }, [consentOpen]);
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
        aria-invalid={message === "voice.needText" ? true : undefined}
        lang="en"
        onChange={(event) => {
          setText(event.target.value);
          setMessage((current) => (current === "voice.needText" ? null : current));
        }}
      />
      <p
        id={statusId}
        className={needsAttention ? "status status--attention" : "status"}
        role={message === "voice.needText" ? "alert" : "status"}
        aria-live={message === "voice.needText" ? "assertive" : "polite"}
      >
        {needsAttention && <ReviewIcon className="icon-inline icon-inline--attention" />}
        {needsAttention && " "}
        {message === null ? "" : t(message)}
      </p>
      {consentOpen && (
        <div className="panel" role="group" aria-labelledby={consentId}>
          <p id={consentId}>
            <LegalText messageKey="voice.consent.text" />
          </p>
          <div className="btn-row">
            <button type="button" ref={consentButton} className="btn" onClick={continueWithVoice}>
              {t("voice.consent.continue")}
            </button>
            <button type="button" className="btn btn--secondary" onClick={typeInstead}>
              {t("voice.consent.type")}
            </button>
          </div>
        </div>
      )}
      <div className="btn-row">
        {canListen && (
          <button
            type="button"
            ref={voiceButton}
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
