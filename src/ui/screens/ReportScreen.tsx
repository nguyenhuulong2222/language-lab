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
import type { InterviewSession, StageSummary } from "../../contracts";
import { Disclaimer } from "../components/Disclaimer";
import { StatusBadge } from "../components/StatusBadge";
import { ReviewIcon } from "../components/icons";
import { STAGES, stageIndex } from "../stages";
import { formatProfileName, formatDate, formatDateTime } from "../format";
import "./ReportScreen.css";

interface ReportScreenProps {
  session: InterviewSession;
}

export function ReportScreen({ session }: ReportScreenProps) {
  const report = session.finalReport;
  if (!report) {
    return (
      <p className="report__empty">
        Your practice report will appear here once the session is complete.
      </p>
    );
  }

  const passed = report.practiceResult === "practice_passed";
  const profileName = formatProfileName(session.fictionalProfileId);
  const take = String(stageIndex(session.currentStage) + 1).padStart(2, "0");

  return (
    <article className="report">
      <header className="report__header">
        <p className="report__overline">
          <span className="report__take" aria-hidden="true">
            TAKE {take}
          </span>
          <span className="report__overline-sep" aria-hidden="true">
            ·
          </span>
          <span className="report__overline-label">Practice report</span>
        </p>
        <h1 className="report__title">
          {passed ? "You’re on track" : "A few things to review"}
        </h1>
        <p className="report__lead">
          {passed
            ? "You completed this practice session well. Use the notes below to keep sharp before your next round."
            : "That’s what practice is for. The notes below show where to focus before you try again."}
        </p>
        <div className="report__profile">
          <p className="report__profile-label">Practice profile (fictional)</p>
          <p className="report__profile-name">{profileName}</p>
          <p className="report__profile-meta">
            {session.testVersion} civics test · filed {formatDate(session.filingDate)}
          </p>
        </div>
      </header>

      <section
        className="report__section"
        aria-labelledby="report-stages-heading"
      >
        <h2 className="report__section-title" id="report-stages-heading">
          How each part went
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
            Things to review
          </h2>
          <p className="report__section-intro">
            Focus on these before your next practice.
          </p>
          <ul className="report__review-list">
            {report.overallReviewItems.map((item, index) => (
              <li key={index} className="report__review-item">
                <ReviewIcon className="report__review-icon" />
                <span className="report__review-text">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Disclaimer
        variant="prominent"
        text={report.disclaimer}
        id="report-disclaimer"
      />

      <p className="report__generated">
        Report generated {formatDateTime(report.generatedAt)}
      </p>
    </article>
  );
}

function StageSummaryCard({ summary }: { summary: StageSummary }) {
  const meta = STAGES[stageIndex(summary.stage)];
  const hasReview = summary.reviewItems.length > 0;
  return (
    <li className="stage-card">
      <div className="stage-card__head">
        <h3 className="stage-card__title">{meta.label}</h3>
        <StatusBadge
          variant={hasReview ? "attention" : "positive"}
          label={hasReview ? "Worth reviewing" : "On track"}
        />
      </div>
      <p className="stage-card__summary">{summary.summary}</p>
      {hasReview && (
        <ul className="stage-card__review">
          {summary.reviewItems.map((item, index) => (
            <li key={index} className="stage-card__review-item">
              <ReviewIcon className="stage-card__review-icon" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
