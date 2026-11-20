/**
 * Study first: browse the civics questions of one test version, one at a time, with the picture
 * (when there is one), the question, the audio and the official answers. Nothing is scored,
 * recorded or reported. This is the only place besides the feedback panel where a picture is shown.
 *
 * The questions and the audio come from the same answer key and clips as the practice. When the
 * answer key is still locked (production build, waiting for a person to review it) the screen
 * says so instead of showing answers.
 */
import { LegalText } from "../components/LegalText";
import { useEffect, useRef, useState } from "react";
import { civicsClipId } from "../../engine/audio-clips";
import type { CivicsAnswerEntry } from "../../engine/civics-answer-key";
import type { AnswerKeyResult } from "../../engine/practice-flow";
import { officialAnswerLines } from "../../engine/official-answer-text";
import { pictureForQuestion, type PictureEntry } from "../../engine/question-images";
import type { CivicsTestVersion } from "../../engine/version-selector";
import { useT } from "../../i18n/react";
import { EnglishNotice } from "../components/EnglishNotice";
import { QuestionPicture } from "../components/QuestionPicture";
import { SpeakButton } from "../components/SpeakButton";
import { TakeHeader } from "../components/TakeHeader";
import "../components/Screen.css";

interface StudyScreenProps {
  answerKey: (version: CivicsTestVersion) => AnswerKeyResult;
  onHome: () => void;
  /** The picture of a question (tests replace it). */
  pictureFor?: (questionId: string) => PictureEntry | null;
  /** Start on a version (tests). */
  initialVersion?: CivicsTestVersion;
  /** Fetch what a version needs (answer key, official answers) before it is shown. */
  prepare?: (version: CivicsTestVersion) => Preparing;
}
type Preparing = Promise<void>;

const VERSIONS: readonly CivicsTestVersion[] = ["2008", "2025"];

/** The static questions of a version, in order. Questions whose answers change are left out, as in the practice. */
export function studyQuestions(key: ReadonlyMap<string, CivicsAnswerEntry>): CivicsAnswerEntry[] {
  return [...key.values()].filter((e) => e.answerType === "static").sort((a, b) => a.id.localeCompare(b.id));
}

export function StudyScreen({ answerKey, onHome, pictureFor = pictureForQuestion, initialVersion, prepare }: StudyScreenProps) {
  const t = useT();
  const [version, setVersion] = useState<CivicsTestVersion | null>(initialVersion ?? null);
  const [index, setIndex] = useState(0);
  const prompt = useRef<HTMLParagraphElement>(null);
  const studying = version !== null;
  // Each new question takes focus, so a screen reader reads it (the heading is always "Study first").
  useEffect(() => {
    if (studying) prompt.current?.focus();
  }, [studying, version, index]);

  const loaded = version === null ? null : answerKey(version);
  if (version !== null && loaded !== null && loaded.status === "locked") {
    return (
      <div className="screen">
        <TakeHeader stage="home" title={t("home.study.title")} />
        <div className="screen__body">
          <p>
            <LegalText messageKey="study.locked" />
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn--secondary" onClick={() => setVersion(null)}>
              {t("study.change")}
            </button>
            <button type="button" className="btn" onClick={onHome}>
              {t("report.home")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (version === null || loaded === null || loaded.status !== "ready") {
    return (
      <div className="screen">
        <TakeHeader stage="home" title={t("home.study.title")} lead={t("study.lead")} />
        <EnglishNotice />
        <fieldset className="screen__body choices">
          <legend className="choices__legend">{t("study.version.legend")}</legend>
          {VERSIONS.map((v) => (
            <button
              key={v}
              type="button"
              className="option-card"
              onClick={() => {
                const show = () => {
                  setVersion(v);
                  setIndex(0);
                };
                if (prepare === undefined) return show();
                void prepare(v).catch(() => {}).then(show);
              }}
            >
              <span className="option-card__title">{t(v === "2008" ? "study.version.2008" : "study.version.2025")}</span>
            </button>
          ))}
        </fieldset>
        <div className="btn-row">
          <button type="button" className="btn btn--secondary" onClick={onHome}>
            {t("report.home")}
          </button>
        </div>
      </div>
    );
  }

  const questions = studyQuestions(loaded.key);
  const entry = questions[Math.min(index, questions.length - 1)];
  if (entry === undefined) return null;
  const lines = officialAnswerLines(version, entry.id);
  const picture = pictureFor(entry.id);
  const last = index >= questions.length - 1;

  return (
    <div className="screen">
      <TakeHeader stage="home" title={t("home.study.title")} focusKey={null} />
      <EnglishNotice />
      <div className="screen__body">
        <p className="progress-line">
          {t("civics.count", { current: index + 1, total: questions.length })}
        </p>
        <p className="prompt" lang="en" ref={prompt} tabIndex={-1}>
          {entry.questionText}
        </p>
        <SpeakButton key={entry.id} text={entry.questionText} clipId={civicsClipId(entry.id)} />
        {picture !== null && <QuestionPicture picture={picture} />}
        {entry.requiredAnswerCount > 1 && <p className="note">{t("civics.needs", { count: entry.requiredAnswerCount })}</p>}
        {lines !== null && (
          <section className="panel">
            <h2 className="panel__title">{t("civics.official")}</h2>
            <ul className="answer-list" lang="en">
              {lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <p className="note"><LegalText messageKey="civics.officialNote" /></p>
          </section>
        )}
        <div className="btn-row">
          <button type="button" className="btn btn--secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            {t("study.prev")}
          </button>
          <button type="button" className="btn" disabled={last} onClick={() => setIndex(index + 1)}>
            {t("civics.next")}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setVersion(null);
              setIndex(0);
            }}
          >
            {t("study.change")}
          </button>
          <button type="button" className="btn btn--secondary" onClick={onHome}>
            {t("report.home")}
          </button>
        </div>
      </div>
    </div>
  );
}
