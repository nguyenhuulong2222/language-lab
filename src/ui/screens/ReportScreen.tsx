/**
 * Practice report screen. Renders the FinalReport from the InterviewSession.
 *
 * Tone is encouraging, never punitive: the outcome uses "practice_passed" /
 * "needs_more_practice" (never pass/fail), and per-item status is shown with an
 * icon + a plain-language label, never color alone. No harsh red anywhere.
 *
 * Content safety: the report always labels the profile as fictional and shows
 * the FinalReport.disclaimer prominently.
 */
import { ENGLISH_MESSAGES, isEnglishOnly, type MessageKey } from "../../i18n";
import { ENGLISH_REVIEW_ITEMS } from "../../engine/report-builder";
import type { InterviewSession, StageSummary } from "../../contracts";
import { Disclaimer } from "../components/Disclaimer";
import { StatusBadge } from "../components/StatusBadge";
import { ReviewIcon } from "../components/icons";
import { STAGES, stageIndex } from "../stages";
import { useLanguage, useT } from "../../i18n/react";
import { formatProfileName, formatDate, formatDateTime } from "../format";
import "./ReportScreen.css";

interface ReportScreenProps {
  session: InterviewSession;
}

export function ReportScreen({ session }: ReportScreenProps) {
  const t = useT();
  const language = useLanguage();
  const report = session.finalReport;
  if (!report) {
    return (
      <p className="report__empty">{t("report.empty")}</p>
    );
  }

  const passed = report.practiceResult === "practice_passed";
  const profileName = formatProfileName(session.fictionalProfileId);
  

  return (
    <article className="report">
      <header className="report__header">
        <p className="report__overline">{t("report.overline")}</p>
        <h1 className="report__title" tabIndex={-1}>
          {passed ? t("report.title.onTrack") : t("report.title.review")}
        </h1>
        <p className="report__lead">
          {passed ? t("report.lead.onTrack") : t("report.lead.review")}
        </p>
        <div className="report__profile">
          <p className="report__profile-label">{t("report.profile.label")}</p>
          <p className="report__profile-name">{profileName}</p>
          <p className="report__profile-meta">
            {t("report.profile.meta", {
              version: session.testVersion,
              date: formatDate(session.filingDate, language),
            })}
          </p>
        </div>
      </header>

      <section
        className="report__section"
        aria-labelledby="report-stages-heading"
      >
        <h2 className="report__section-title" id="report-stages-heading">
          {t("report.stages.heading")}
        </h2>
        <ol className="report__stages">
          {report.stageSummaries.map((summary) => (
            <StageSummaryCard key={summary.stage} summary={summary} />
          ))}
        </ol>
      </section>

      {report.overallReviewItems.length > 0 && (
        <section
          className="report__section"
          aria-labelledby="report-review-heading"
        >
          <h2 className="report__section-title" id="report-review-heading">
            {t("report.review.heading")}
          </h2>
          <p className="report__section-intro">{t("report.review.intro")}</p>
          <ul className="report__review-list">
            {report.overallReviewItems.map((item, index) => {
              const own = reviewItemKey(item);
              return (
                <li key={index} className="report__review-item" {...(own === null ? { lang: "en" } : {})}>
                  <ReviewIcon className="report__review-icon" />
                  <span className="report__review-text">{own === null ? item : t(own)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Disclaimer
        variant="prominent"
        text={report.disclaimer}
        id="report-disclaimer"
      />
      {/* The report carries its disclaimer in English (contract field); say it in the chosen language too. */}
      {language !== "en" && !isEnglishOnly(language, "disclaimer.report") && <Disclaimer messageKey="disclaimer.report" />}

      <p className="report__generated">
        {t("report.generated", { datetime: formatDateTime(report.generatedAt, language) })}
      </p>
    </article>
  );
}

/**
 * The summary lines as known message keys (CR-007), or null: then the English `summary` is shown.
 * Question texts inside a line stay English; they are the official wording.
 */
function summaryLines(summary: StageSummary): Array<{ key: MessageKey; params?: Record<string, string | number> }> | null {
  const lines = summary.summaryLines;
  if (lines === undefined || lines.length === 0) return null;
  if (!lines.every((l) => Object.prototype.hasOwnProperty.call(ENGLISH_MESSAGES, l.key))) return null;
  return lines.map((l) => ({ key: l.key as MessageKey, ...(l.params === undefined ? {} : { params: l.params }) }));
}

/** The message key of a review item the engine writes (reading and writing), or null for question texts. */
function reviewItemKey(item: string): MessageKey | null {
  for (const own of Object.values(ENGLISH_REVIEW_ITEMS)) if (own.text === item) return own.key;
  return null;
}

function StageSummaryCard({ summary }: { summary: StageSummary }) {
  const t = useT();
  const language = useLanguage();
  const lines = summaryLines(summary);
  const meta = STAGES[stageIndex(summary.stage)];
  const hasReview = summary.reviewItems.length > 0;
  return (
    <li className="stage-card">
      <div className="stage-card__head">
        <h3 className="stage-card__title">{t(meta.labelKey)}</h3>
        <StatusBadge
          variant={hasReview ? "attention" : "positive"}
          label={hasReview ? t("badge.review") : t("badge.onTrack")}
        />
      </div>
      {lines === null ? (
        <p className="stage-card__summary" lang="en">{summary.summary}</p>
      ) : (
        <p className="stage-card__summary">
          {lines.map((l, i) => (
            <span key={i} {...(isEnglishOnly(language, l.key) ? { lang: "en" } : {})}>
              {i > 0 ? " " : ""}
              {t(l.key, l.params)}
            </span>
          ))}
        </p>
      )}
      {hasReview && (
        <ul className="stage-card__review">
          {summary.reviewItems.map((item, index) => {
            const own = reviewItemKey(item);
            return (
              <li key={index} className="stage-card__review-item" {...(own === null ? { lang: "en" } : {})}>
                <ReviewIcon className="stage-card__review-icon" />
                <span>{own === null ? item : t(own)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
