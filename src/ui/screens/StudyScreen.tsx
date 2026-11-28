/**
 * Study first: browse the civics questions of one test version, one at a time, with the picture
 * (when there is one), the question, the audio and the official answers. Nothing is scored,
 * recorded or reported. This is the only place besides the feedback panel where a picture is shown.
 *
 * Any question can be picked: "Question list" (a modal list with a search box) or "Go to question
 * number". Two ways to study, in memory only: "See the answers" (as before), or "Test myself": the
 * official answers and the picture stay hidden until the learner answers and taps Check. The answer
 * is graded with the civics grader and the answer key only (src/engine/study-check.ts), exactly as
 * the civics part grades one answer. No score, no count, nothing saved or sent.
 *
 * The questions and the audio come from the same answer key and clips as the practice. When the
 * answer key is still locked (production build, waiting for a person to review it) the screen
 * says so instead of showing answers.
 */
import { LegalText } from "../components/LegalText";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { civicsClipId } from "../../engine/audio-clips";
import type { CivicsAnswerEntry } from "../../engine/civics-answer-key";
import type { AnswerKeyResult, InputMode } from "../../engine/practice-flow";
import { checkStudyAnswer, type StudyCheck } from "../../engine/study-check";
import { officialAnswerLines } from "../../engine/official-answer-text";
import { illustrationForQuestion, type IllustrationEntry } from "../../engine/illustrations";
import { pictureForQuestion, type PictureEntry } from "../../engine/question-images";
import type { CivicsTestVersion } from "../../engine/version-selector";
import { useT } from "../../i18n/react";
import { AnswerInput } from "../components/AnswerInput";
import { EnglishNotice } from "../components/EnglishNotice";
import { CheckIcon, ReviewIcon } from "../components/icons";
import { useModalDialog } from "../components/use-modal-dialog";
import { useTWithEnglish } from "../components/with-english";
import { QuestionIllustration, QuestionPicture } from "../components/QuestionPicture";
import { SpeakButton } from "../components/SpeakButton";
import { ActionCard } from "../components/ActionCard";
import { TakeHeader } from "../components/TakeHeader";
import { SpecialLanguageLine } from "../components/SpecialConsiderationNote";
import "../components/Screen.css";
import "./StudyScreen.css";

interface StudyScreenProps {
  answerKey: (version: CivicsTestVersion) => AnswerKeyResult;
  onHome: () => void;
  /** The picture of a question (tests replace it). */
  pictureFor?: (questionId: string) => PictureEntry | null;
  /** The reviewed AI illustration of a CONCEPT question (tests replace it), used when there is no picture. */
  illustrationFor?: (questionId: string) => IllustrationEntry | null;
  /** Start on a version (tests). */
  initialVersion?: CivicsTestVersion;
  /** Fetch what a version needs (answer key, official answers) before it is shown. */
  prepare?: (version: CivicsTestVersion) => Preparing;
  /** The 65/20 designated ids of a version (spec release-finish REQ-S07). Absent: no 65/20 option. */
  designated?: (version: CivicsTestVersion) => readonly string[];
  /** Start with "only the 65/20 questions" ticked (65/20 chosen on Home, tests). */
  initialSpecialOnly?: boolean;
  /** An exception chosen on Home: the interpreter note (65/20 shows the starred questions too). */
  interpreterNote?: boolean;
}
type Preparing = Promise<void>;

const VERSIONS: readonly CivicsTestVersion[] = ["2008", "2025"];

export type StudyMode = "see" | "test";

/** The history entry of the open question list (with the section flag: see use-modal-dialog.ts). */
const LIST_STATE = { languageLabSection: true, languageLabStudyList: true } as const;

/** Lower case, no accents: the search matches "Constitucion" and "constitución" alike. */
export function searchable(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** The questions whose English text contains the search words, with their number in the set (1-based). */
export function findQuestions(questions: readonly CivicsAnswerEntry[], query: string): Array<{ number: number; entry: CivicsAnswerEntry }> {
  const wanted = searchable(query);
  return questions
    .map((entry, i) => ({ number: i + 1, entry }))
    .filter(({ entry }) => wanted === "" || searchable(entry.questionText).includes(wanted));
}

/** The 0-based index for a typed question number, or null when it is not a whole number from 1 to total. */
export function questionIndexFor(typed: string, total: number): number | null {
  const trimmed = typed.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= 1 && n <= total ? n - 1 : null;
}

/** The static questions of a version, in order. Questions whose answers change are left out, as in the practice. */
export function studyQuestions(key: ReadonlyMap<string, CivicsAnswerEntry>): CivicsAnswerEntry[] {
  return [...key.values()].filter((e) => e.answerType === "static").sort((a, b) => a.id.localeCompare(b.id));
}

export function StudyScreen({ answerKey, onHome, pictureFor = pictureForQuestion, illustrationFor = illustrationForQuestion, initialVersion, prepare, designated, initialSpecialOnly = false, interpreterNote = false }: StudyScreenProps) {
  const t = useT();
  const [specialOnly, setSpecialOnly] = useState(initialSpecialOnly && designated !== undefined);
  const [version, setVersion] = useState<CivicsTestVersion | null>(initialVersion ?? null);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<StudyMode>("see");
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
            <button type="button" className="btn btn--primary" onClick={onHome}>
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
        {interpreterNote && (
          <p className="note">
            <LegalText messageKey="study.exempt.note" />
          </p>
        )}
        <fieldset className="screen__body choices">
          <legend className="choices__legend">{t("study.version.legend")}</legend>
          {designated !== undefined && (
            <label className="choice">
              <input
                className="choice__input"
                type="checkbox"
                name="study-special"
                checked={specialOnly}
                onChange={(event) => setSpecialOnly(event.target.checked)}
              />
              <span className="choice__text">{t("study.special.label")}</span>
            </label>
          )}
          {VERSIONS.map((v) => (
            <ActionCard
              key={v}
              title={t(v === "2008" ? "study.version.2008" : "study.version.2025")}
              verb={t("home.go.open")}
              onClick={() => {
                const show = () => {
                  setVersion(v);
                  setIndex(0);
                };
                if (prepare === undefined) return show();
                void prepare(v).catch(() => {}).then(show);
              }}
            />
          ))}
        </fieldset>
      </div>
    );
  }

  const allStatic = studyQuestions(loaded.key);
  const designatedIds = specialOnly && designated !== undefined ? designated(version) : null;
  // 65/20: the designated questions in list order; those whose answers change are left out, as in the practice.
  const questions = designatedIds === null ? allStatic : allStatic.filter((e) => designatedIds.includes(e.id));
  const leftOut = designatedIds === null ? 0 : designatedIds.length - questions.length;
  return (
    <StudyQuestion
      key={`${version}-${designatedIds === null ? "all" : "special"}`}
      version={version}
      questions={questions}
      answerKey={loaded.key}
      index={Math.min(index, questions.length - 1)}
      onIndex={setIndex}
      mode={mode}
      onMode={setMode}
      prompt={prompt}
      onHome={onHome}
      onChangeTest={() => {
        setVersion(null);
        setIndex(0);
      }}
      pictureFor={pictureFor}
      illustrationFor={illustrationFor}
      interpreterNote={interpreterNote}
      special={designatedIds === null ? null : { leftOut, bank: designatedIds.length }}
    />
  );
}

interface StudyQuestionProps {
  version: CivicsTestVersion;
  questions: readonly CivicsAnswerEntry[];
  answerKey: ReadonlyMap<string, CivicsAnswerEntry>;
  index: number;
  onIndex: (index: number) => void;
  mode: StudyMode;
  onMode: (mode: StudyMode) => void;
  prompt: React.RefObject<HTMLParagraphElement | null>;
  onHome: () => void;
  onChangeTest: () => void;
  pictureFor: (questionId: string) => PictureEntry | null;
  illustrationFor: (questionId: string) => IllustrationEntry | null;
  interpreterNote: boolean;
  /** The 65/20 filter is on: how many designated questions are left out (answers that change), of how many. */
  special: { leftOut: number; bank: number } | null;
}

interface CheckedAnswer extends StudyCheck {
  questionId: string;
  input: InputMode;
  alternatives: number;
}

function StudyQuestion({
  version,
  questions,
  answerKey,
  index,
  onIndex,
  mode,
  onMode,
  prompt,
  onHome,
  onChangeTest,
  pictureFor,
  illustrationFor,
  interpreterNote,
  special,
}: StudyQuestionProps) {
  const t = useT();
  const tEnglish = useTWithEnglish();
  const [checked, setChecked] = useState<CheckedAnswer | null>(null);
  // A new AnswerInput (an empty box) after "Try again" and on every question.
  const [attempt, setAttempt] = useState(0);
  const result = useRef<HTMLHeadingElement>(null);
  const modeName = useId();
  const entry = questions[index];
  const shownCheck = checked !== null && entry !== undefined && checked.questionId === entry.id ? checked : null;

  // The result appears after a button press: move focus to it so it is read first (as in the civics part).
  useEffect(() => {
    if (shownCheck !== null) result.current?.focus();
  }, [shownCheck]);

  if (entry === undefined) return null;
  const go = (next: number) => {
    setChecked(null);
    setAttempt((n) => n + 1);
    onIndex(next);
  };
  const lines = officialAnswerLines(version, entry.id);
  const testing = mode === "test";
  // In "Test myself", the answers and the picture come only after Check: they would give the answer away.
  const reveal = !testing || shownCheck !== null;
  const picture = reveal ? pictureFor(entry.id) : null;
  const illustration = reveal && picture === null ? illustrationFor(entry.id) : null;
  const last = index >= questions.length - 1;
  // One filled button per state: while an answer waits for Check, Check is the one.
  const navPrimary = !testing || shownCheck !== null;
  const correct = shownCheck?.result === "correct";
  const Icon = correct ? CheckIcon : ReviewIcon;

  const officialAnswers = lines !== null && (
    <>
      <h3 className="panel__title">{t("civics.official")}</h3>
      <ul className="answer-list" lang="en">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <p className="note">
        <LegalText messageKey="civics.officialNote" />
      </p>
    </>
  );

  return (
    <div className="screen">
      <TakeHeader stage="home" title={t("home.study.title")} focusKey={null} />
      <EnglishNotice />
      <div className="screen__body">
        <fieldset className="choices study-mode">
          <legend className="choices__legend">{t("study.mode.legend")}</legend>
          {(["see", "test"] as const).map((m) => (
            <label key={m} className="choice">
              <input
                className="choice__input"
                type="radio"
                name={modeName}
                value={m}
                checked={mode === m}
                onChange={() => {
                  // The same question; a new start in the chosen way.
                  setChecked(null);
                  setAttempt((n) => n + 1);
                  onMode(m);
                }}
              />
              <span className="choice__text">{t(m === "see" ? "study.mode.see" : "study.mode.test")}</span>
            </label>
          ))}
        </fieldset>
        <StudyNavigator questions={questions} index={index} onGo={go} />
        <p className="progress-line">{t("civics.count", { current: index + 1, total: questions.length })}</p>
        {/* With the 65/20 filter on, the 65/20 line below already says it. */}
        {interpreterNote && index === 0 && special === null && (
          <p className="note">
            <LegalText messageKey="study.exempt.note" />
          </p>
        )}
        {special !== null && index === 0 && (
          <>
            {special.leftOut > 0 && (
              <p className="note">
                <LegalText messageKey="study.special.dynamic" params={{ count: special.leftOut, bank: special.bank }} />
              </p>
            )}
            <SpecialLanguageLine />
          </>
        )}
        <p className="prompt" lang="en" ref={prompt} tabIndex={-1}>
          {entry.questionText}
        </p>
        <SpeakButton key={entry.id} text={entry.questionText} clipId={civicsClipId(entry.id)} />
        {!testing && picture !== null && <QuestionPicture key={picture.id} picture={picture} />}
        {!testing && illustration !== null && <QuestionIllustration key={illustration.id} illustration={illustration} />}
        {entry.requiredAnswerCount > 1 && <p className="note">{t("civics.needs", { count: entry.requiredAnswerCount })}</p>}
        {!testing && lines !== null && <section className="panel">{officialAnswers}</section>}
        {testing && shownCheck === null && (
          <AnswerInput
            key={`${entry.id}-${attempt}`}
            label={t("civics.yourAnswer")}
            submitLabel={t("study.check")}
            voice
            onSubmit={(text, input, alternatives) => {
              const graded = checkStudyAnswer(entry, answerKey, text, alternatives ?? []);
              setChecked({ ...graded, questionId: entry.id, input, alternatives: 1 + (alternatives?.length ?? 0) });
            }}
          />
        )}
        {testing && shownCheck !== null && (
          <>
            <section className={correct ? "panel panel--correct" : "panel panel--wrong"}>
              <h2 className="result-headline" ref={result} tabIndex={-1}>
                <Icon className={correct ? "icon-inline" : "icon-inline icon-inline--attention"} /> {correct ? t("civics.correct") : t("civics.notYet")}
              </h2>
              <p className="result-reason">{correct ? t("civics.why.correct") : t("civics.why.notYet")}</p>
              <p>{tEnglish("civics.youSaid", { text: shownCheck.response === "" ? "…" : shownCheck.response })}</p>
              {shownCheck.response !== "" && (
                <p className="note">
                  {shownCheck.input === "voice" ? t("compare.honest.heard") : t("compare.honest.typed")}
                  {shownCheck.input === "voice" && shownCheck.alternatives > 1 && <> {t("civics.heard.closest")}</>}
                </p>
              )}
              {officialAnswers}
              {picture !== null && <QuestionPicture key={picture.id} picture={picture} />}
              {illustration !== null && <QuestionIllustration key={illustration.id} illustration={illustration} />}
            </section>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setChecked(null);
                  setAttempt((n) => n + 1);
                }}
              >
                {t("study.tryAgain")}
              </button>
            </div>
          </>
        )}
        {/* Previous and Next side by side, 56px. After the last question: Back to Home (the next step). */}
        <div className="btn-pair">
          {index > 0 && (
            <button type="button" className="btn btn--secondary" onClick={() => go(index - 1)}>
              {t("study.prev")}
            </button>
          )}
          {last ? (
            <button type="button" className={navPrimary ? "btn btn--primary" : "btn btn--secondary"} onClick={onHome}>
              {t("report.home")}
            </button>
          ) : (
            <button type="button" className={navPrimary ? "btn btn--primary" : "btn btn--secondary"} onClick={() => go(index + 1)}>
              {t("civics.next")}
            </button>
          )}
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn--secondary" onClick={onChangeTest}>
            {t("study.change")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Question list" (a modal list with a search box) and "Go to question number". */
function StudyNavigator({ questions, index, onGo }: { questions: readonly CivicsAnswerEntry[]; index: number; onGo: (index: number) => void }) {
  const t = useT();
  const list = useModalDialog(LIST_STATE);
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState("");
  const [invalid, setInvalid] = useState(false);
  const titleId = useId();
  const searchId = useId();
  const numberId = useId();
  const messageId = useId();
  const found = useMemo(() => findQuestions(questions, query), [questions, query]);

  const jump = (target: number) => {
    // A new question takes focus itself (the question text); the same one gives focus back to the list button.
    list.close({ returnFocus: target === index });
    if (target !== index) onGo(target);
  };

  return (
    <div className="study-nav">
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--secondary"
          aria-haspopup="dialog"
          onClick={(event) => {
            setQuery("");
            list.open(event.currentTarget);
          }}
        >
          {t("study.list.open")}
        </button>
      </div>
      <form
        className="study-nav__go"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const target = questionIndexFor(typed, questions.length);
          setInvalid(target === null);
          if (target !== null) {
            setTyped("");
            if (target !== index) onGo(target);
          }
        }}
      >
        <label className="study-nav__label" htmlFor={numberId}>
          {t("study.go.label")}
        </label>
        <div className="study-nav__row">
          <input
            id={numberId}
            className="field__input study-nav__number"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={typed}
            aria-invalid={invalid}
            aria-describedby={messageId}
            onChange={(event) => {
              setTyped(event.target.value);
              setInvalid(false);
            }}
          />
          <button type="submit" className="btn btn--secondary">
            {t("study.go.submit")}
          </button>
        </div>
        <p id={messageId} className={invalid ? "status status--attention" : "ll-sr-only"} role="status">
          {invalid && <ReviewIcon className="icon-inline icon-inline--attention" />}
          {invalid ? ` ${t("study.go.invalid", { total: questions.length })}` : ""}
        </p>
      </form>
      <dialog ref={list.dialogRef} className="study-list" aria-labelledby={titleId} onClick={list.onDialogClick}>
        <div className="study-list__bar">
          <button ref={list.closeRef} type="button" className="btn btn--primary study-list__close" onClick={() => list.close()}>
            {t("study.list.close")}
          </button>
        </div>
        <h2 id={titleId} className="study-list__title">
          {t("study.list.open")}
        </h2>
        <label className="study-nav__label" htmlFor={searchId}>
          {t("study.list.search")}
        </label>
        <input
          id={searchId}
          className="field__input study-list__search"
          type="search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {found.length === 0 ? (
          <p className="status" role="status">
            {t("study.list.none")}
          </p>
        ) : (
          <ul className="study-list__items">
            {found.map(({ number, entry }) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="study-list__row"
                  aria-current={number - 1 === index ? "true" : undefined}
                  onClick={() => jump(number - 1)}
                >
                  <span className="study-list__number">{number}.</span> <span lang="en">{entry.questionText}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </dialog>
    </div>
  );
}
