/**
 * The report of one practised part. It has no overall practice result: it says what happened in
 * this part, lists what to review, and carries the practice disclaimer. (The contract has no
 * partial report; see CR-006.)
 */
import type { PartReport, PracticePart } from "../../engine/part-report";
import type { MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { Disclaimer } from "../components/Disclaimer";
import { CheckIcon, ReviewIcon } from "../components/icons";
import { StatusBadge } from "../components/StatusBadge";
import { TakeHeader } from "../components/TakeHeader";
import { formatDateTime } from "../format";
import "../components/Screen.css";

const percent = (share: number): number => Math.round(share * 100);

const TITLE: Record<PracticePart, MessageKey> = {
  n400_interview: "partReport.title.n400_interview",
  reading: "partReport.title.reading",
  writing: "partReport.title.writing",
  civics: "partReport.title.civics",
};

export function PartReportScreen({ report, onHome }: { report: PartReport; onHome: () => void }) {
  const t = useT();
  return (
    <div className="screen">
      <TakeHeader stage="report" title={t(TITLE[report.part])} lead={t("partReport.scope")} />
      <div className="screen__body">
        <PartBody report={report} />
        <Disclaimer variant="prominent" id="part-report-disclaimer" text={t("disclaimer.report")} />
        <p className="progress-line">{t("report.generated", { datetime: formatDateTime(report.generatedAt) })}</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={onHome}>
            {t("report.home")}
          </button>
        </div>
      </div>
    </div>
  );
}

function PartBody({ report }: { report: PartReport }) {
  const t = useT();

  if (report.part === "n400_interview") {
    return (
      <section className="panel">
        <p>{report.answers.length === 0 ? t("partReport.none") : t("partReport.n400.lead")}</p>
        <ol className="answer-list">
          {report.answers.map((a, i) => (
            <li key={i}>
              <strong lang="en">{a.question}</strong>
              <br />
              <span lang="en">{a.transcript}</span>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  if (report.part === "civics") {
    const scored = report.correct + report.incorrect;
    return (
      <>
        <section className="panel">
          <StatusBadge
            variant={report.passed ? "positive" : "attention"}
            label={report.passed ? t("badge.onTrack") : t("badge.review")}
          />
          <p>
            {scored === 0
              ? t("partReport.none")
              : t("partReport.civics.summary", { correct: report.correct, scored })}
          </p>
          <p>{t("partReport.civics.needed", { needed: report.passingScore })}</p>
          <p className="note">
            {report.stopReason === "correct_threshold"
              ? t("civics.stopped.correct")
              : report.stopReason === "incorrect_threshold"
                ? t("civics.stopped.incorrect")
                : t("civics.stopped.none")}
          </p>
        </section>
        {report.reviewItems.length > 0 && (
          <section className="panel">
            <h2 className="panel__title">{t("partReport.review")}</h2>
            <ul className="answer-list" lang="en">
              {report.reviewItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        )}
        {report.unscored.length > 0 && (
          <section className="panel">
            <h2 className="panel__title">{t("partReport.unscored.title")}</h2>
            <p>{t("partReport.unscored.text")}</p>
            <ul className="answer-list" lang="en">
              {report.unscored.map((u) => (
                <li key={u.turnId}>{u.questionText ?? t("partReport.unscored.missing")}</li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }

  // Reading and writing
  return (
    <>
      <section className="panel">
        <StatusBadge
          variant={report.passed ? "positive" : "attention"}
          label={report.passed ? t("badge.onTrack") : t("badge.review")}
        />
        <p>
          {report.attempts === 0
            ? t("partReport.none")
            : t("partReport.sentences", { correct: report.correct, attempts: report.attempts })}
        </p>
        <p>{t("partReport.sentencesNeeded", { needed: report.neededCorrect })}</p>
      </section>
      {report.items.map((item, i) => {
        const Icon = item.isCorrect ? CheckIcon : ReviewIcon;
        return (
          <section key={i} className="panel">
            <p className="progress-line">{t("partReport.sentence")}</p>
            <p lang="en">{item.sentence}</p>
            <p className="progress-line">{report.part === "reading" ? t("partReport.said") : t("partReport.typed")}</p>
            <p lang="en">{item.transcript === "" ? "…" : item.transcript}</p>
            <p>
              <Icon className={item.isCorrect ? "icon-inline" : "icon-inline icon-inline--attention"} />{" "}
              {item.isCorrect ? t("compare.close", { percent: percent(item.accuracy) }) : t("compare.notYet", { percent: percent(item.accuracy) })}
            </p>
          </section>
        );
      })}
    </>
  );
}
