/**
 * Disclaimer content, reused across the shell (header About panel, footer) and
 * the report (prominent). The report uses the FinalReport.disclaimer value from
 * the contract; the chrome uses the standing copy below.
 */
import "./Disclaimer.css";

/** Short standing line for the footer. */
export const DISCLAIMER_SHORT =
  "Not affiliated with USCIS or any government agency. Not legal advice.";

/** Full standing text for the header About panel. */
export const DISCLAIMER_FULL =
  "Language Lab is an independent practice tool. It is not affiliated with, endorsed by, " +
  "or connected to USCIS, DHS, or any U.S. government agency. Practice results do not " +
  "predict or reflect any official immigration decision. Nothing here is legal advice. " +
  "Consult a qualified immigration attorney for guidance on your actual case.";

type DisclaimerVariant = "inline" | "prominent";

interface DisclaimerProps {
  text: string;
  variant?: DisclaimerVariant;
  id?: string;
}

export function Disclaimer({ text, variant = "inline", id }: DisclaimerProps) {
  if (variant === "prominent") {
    return (
      <section className="disclaimer disclaimer--prominent" aria-labelledby={id}>
        <h2 className="disclaimer__title" id={id}>
          Please read this
        </h2>
        <p className="disclaimer__text">{text}</p>
      </section>
    );
  }

  return <p className="disclaimer disclaimer--inline">{text}</p>;
}
