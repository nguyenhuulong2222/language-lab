/**
 * Feedback after one reading or writing attempt: the comparison with the sentence, the
 * percentage of matched words, and the practice setting behind "good". The setting is
 * Language Lab's own, not a USCIS rule, and the text says so.
 */
import { useEffect, useRef } from "react";
import { compareSentence } from "../../engine/sentence-compare";
import type { SentenceAttempt } from "../../engine/practice-flow";
import { useT } from "../../i18n/react";
import { Disclaimer } from "./Disclaimer";
import { CheckIcon, ReviewIcon } from "./icons";
import { SentenceDiff } from "./SentenceDiff";
import "./Screen.css";

interface SentenceFeedbackProps {
  target: string;
  attempt: SentenceAttempt;
  /** Words that must match, from the practice config (0 to 1). */
  minWordAccuracy: number;
  /** "reading" shows what was heard; "writing" shows what was typed. */
  kind: "reading" | "writing";
}

const percent = (share: number): number => Math.round(share * 100);

export function SentenceFeedback({ target, attempt, minWordAccuracy, kind }: SentenceFeedbackProps) {
  const t = useT();
  const comparison = compareSentence(target, attempt.transcript, minWordAccuracy);
  const heardLabel = kind === "writing" || attempt.input === "typed" ? t("compare.typed") : t("compare.heard");
  const Icon = attempt.isCorrect ? CheckIcon : ReviewIcon;
  const heading = useRef<HTMLHeadingElement>(null);

  // The result appears after a button press: move focus to it so it is read first.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section className="panel">
      <h2 className="panel__title" ref={heading} tabIndex={-1}>
        <Icon className={attempt.isCorrect ? "icon-inline" : "icon-inline icon-inline--attention"} />{" "}
        {attempt.isCorrect
          ? t("compare.close", { percent: percent(attempt.accuracy) })
          : t("compare.notYet", { percent: percent(attempt.accuracy) })}
      </h2>
      <p className="progress-line">{t("compare.wanted")}</p>
      <p lang="en">{target}</p>
      <p className="progress-line">{heardLabel}</p>
      <p lang="en">{attempt.transcript === "" ? "…" : attempt.transcript}</p>
      <SentenceDiff diff={comparison.diff} />
      <p className="note">{t("compare.setting", { percent: percent(minWordAccuracy) })}</p>
      <Disclaimer text={t("disclaimer.short")} />
    </section>
  );
}
