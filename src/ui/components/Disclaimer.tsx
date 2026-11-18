/**
 * Disclaimer content, reused across the shell (header About panel, footer) and the report
 * (prominent). The report uses the FinalReport.disclaimer value from the contract (English, from
 * the engine); the chrome uses the standing copy from the locale file.
 *
 * Content-safety rule 3, point b: in every non-English language the disclaimer is shown together
 * with its English text. A disclaimer given as a message key (`messageKey`) always carries it.
 */
import type { MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { EnglishLine } from "./EnglishLine";
import "./Disclaimer.css";

type DisclaimerVariant = "inline" | "prominent";

type DisclaimerProps = {
  variant?: DisclaimerVariant;
  id?: string;
} & ({ messageKey: MessageKey; text?: never } | { text: string; messageKey?: never });

export function Disclaimer({ messageKey, text, variant = "inline", id }: DisclaimerProps) {
  const t = useT();
  const body = messageKey === undefined ? text : t(messageKey);
  const english = messageKey === undefined ? null : <EnglishLine messageKey={messageKey} className="disclaimer__english" />;

  if (variant === "prominent") {
    return (
      <section className="disclaimer disclaimer--prominent" aria-labelledby={id}>
        <h2 className="disclaimer__title" id={id}>
          {t("disclaimer.title")}
        </h2>
        <p className="disclaimer__text">{body}</p>
        {english !== null && <p className="disclaimer__text disclaimer__text--english">{english}</p>}
      </section>
    );
  }
  return (
    <p className="disclaimer disclaimer--inline">
      {body}
      {english !== null && <> {english}</>}
    </p>
  );
}
