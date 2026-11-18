/** The three steps of a practice screen in plain words: listen, speak or type, see the result. */
import { useT } from "../../i18n/react";
import "./Screen.css";

export function HowItWorks() {
  const t = useT();
  const steps = [
    { title: t("home.how.1.title"), text: t("home.how.1.text") },
    { title: t("home.how.2.title"), text: t("home.how.2.text") },
    { title: t("home.how.3.title"), text: t("home.how.3.text") },
  ];
  return (
    <section className="panel panel--well" aria-labelledby="how-it-works">
      <h2 id="how-it-works" className="panel__title">
        {t("home.how.title")}
      </h2>
      <ol className="how-steps">
        {steps.map((step) => (
          <li key={step.title}>
            <strong>{step.title}.</strong> {step.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
