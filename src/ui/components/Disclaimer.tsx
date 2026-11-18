/**
 * Disclaimer content, reused across the shell (header About panel, footer) and
 * the report (prominent). The report uses the FinalReport.disclaimer value from
 * the contract; the chrome uses the standing copy from the locale file (disclaimer.short / disclaimer.full).
 */
import { useT } from "../../i18n/react";
import "./Disclaimer.css";


type DisclaimerVariant = "inline" | "prominent";

interface DisclaimerProps {
  text: string;
  variant?: DisclaimerVariant;
  id?: string;
}

export function Disclaimer({ text, variant = "inline", id }: DisclaimerProps) {
  const t = useT();
  if (variant === "prominent") {
    return (
      <section className="disclaimer disclaimer--prominent" aria-labelledby={id}>
        <h2 className="disclaimer__title" id={id}>
          {t("disclaimer.title")}
        </h2>
        <p className="disclaimer__text">{text}</p>
      </section>
    );
  }

  return <p className="disclaimer disclaimer--inline">{text}</p>;
}
