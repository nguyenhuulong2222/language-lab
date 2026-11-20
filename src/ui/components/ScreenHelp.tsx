/**
 * A "How this works" button with a few short steps for one screen, in plain words. It opens by
 * itself the first time the screen is shown in a session, and can be opened any time.
 * Typing is always named as an option, and so is what the microphone button and Skip do.
 */
import { useEffect, useId, useState, type ReactNode } from "react";
import type { MessageKey } from "../../i18n";
import { LegalText } from "./LegalText";
import { useT } from "../../i18n/react";
import { useHelpSeen } from "../help-session";
import "./ScreenHelp.css";

export type HelpScreen = "setup" | "n400" | "reading" | "writing" | "civics";

export function ScreenHelp({ screen }: { screen: HelpScreen }) {
  const t = useT();
  const seen = useHelpSeen();
  const panelId = useId();
  const [open, setOpen] = useState(() => !seen.has(screen));

  useEffect(() => {
    seen.add(screen);
  }, [seen, screen]);

  const mic = t("help.mic", { say: t("voice.say"), stop: t("voice.stop") });
  const listen = t("help.listen", { play: t("audio.play") });
  const skip = t("help.skip", { skip: t("voice.skip") });

  let steps: ReactNode[];
  switch (screen) {
    case "setup":
      steps = [t("help.setup.1"), <LegalText key="s2" messageKey="help.setup.2" />, t("help.setup.3", { start: t("intro.start") })];
      break;
    case "n400":
      steps = [listen, t("help.sample"), mic, t("help.type"), t("help.send", { send: t("n400.save") }), t("help.notScored")];
      break;
    case "reading":
      steps = [
        t("help.read"),
        mic,
        t("help.type"),
        t("help.send", { send: t("reading.submit") }),
        skip,
        t("help.result.reading"),
      ];
      break;
    case "writing":
      steps = [listen, t("help.typeOnly"), t("help.send", { send: t("writing.submit") }), skip, t("help.result.reading")];
      break;
    case "civics":
      steps = [listen, mic, t("help.type"), t("help.send", { send: t("civics.submit") }), skip, t("help.result.civics")];
      break;
  }

  const label: MessageKey = "help.button";
  return (
    <div className="help">
      <button
        type="button"
        className="btn btn--secondary help__button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {t(label)}
      </button>
      <div id={panelId} className="help__panel" hidden={!open}>
        <ol className="help__steps">
          {steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
