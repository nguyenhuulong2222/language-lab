/**
 * A "Help" button with three short numbered steps for one screen, in plain words. It opens by
 * itself (in the page, not a pop-up) the first time the screen is shown in a session, and can be
 * opened any time. Where there is a microphone, typing is named as the other way to answer.
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

  const mic = t("help.mic", { say: t("voice.say") });
  const listen = t("help.listen", { play: t("audio.play") });
  // Three steps on every screen: what to do first, how to answer, what happens next.
  let steps: [ReactNode, ReactNode, ReactNode];
  switch (screen) {
    case "setup":
      steps = [t("help.setup.1"), <LegalText key="s2" messageKey="help.setup.2" />, t("help.setup.3", { start: t("intro.start") })];
      break;
    case "n400":
      steps = [listen, mic, t("help.done.n400", { send: t("n400.save") })];
      break;
    case "reading":
      steps = [t("help.read"), mic, t("help.done.english", { send: t("reading.submit") })];
      break;
    case "writing":
      steps = [t("help.listen", { play: t("audio.playSentence") }), t("help.typeOnly"), t("help.done.english", { send: t("writing.submit") })];
      break;
    case "civics":
      steps = [listen, mic, t("help.done.civics", { send: t("civics.submit") })];
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
