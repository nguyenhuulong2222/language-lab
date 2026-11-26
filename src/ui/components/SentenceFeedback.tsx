/**
 * Feedback after one reading or writing attempt (spec BS-22, BS-25): whether it counts, what was
 * heard (the best alternative the recogniser gave), one plain line for every difference, and one
 * line saying the result rests on the words the device heard (or the words typed).
 *
 * A near miss is a plain sentence, for example: You said "elect". The sentence says "elects". This
 * still counts. There is no crossed-out or dashed display. The practice rule is Language Lab's own
 * setting, based on the USCIS scoring guidelines, and the text says so.
 */
import { LegalText } from "./LegalText";
import { useEffect, useRef } from "react";
import { compareSentence, type MatchNote, type MatchOptions } from "../../engine/sentence-compare";
import type { SentenceAttempt } from "../../engine/practice-flow";
import type { MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { useTWithEnglish } from "./with-english";
import { CheckIcon, ReviewIcon } from "./icons";
import "./Screen.css";

interface SentenceFeedbackProps {
  target: string;
  attempt: SentenceAttempt;
  /** How an attempt is scored (the practice config). */
  matchOptions: MatchOptions;
  /** "reading" shows what was heard; "writing" shows what was typed. */
  kind: "reading" | "writing";
}

/** The message and values of the plain line for one note. */
function lineFor(note: MatchNote, typed: boolean, stillCounts: boolean): { key: MessageKey; params: Record<string, string> } {
  const said = note.said ?? "";
  const expected = note.expected ?? "";
  switch (note.kind) {
    case "variant":
      return { key: typed ? "compare.note.variant.wrote" : "compare.note.variant.said", params: { said, expected } };
    case "spelling":
      return { key: "compare.note.spelling", params: { said, expected } };
    case "different":
      return { key: typed ? "compare.note.different.wrote" : "compare.note.different.said", params: { said, expected } };
    case "missing-content":
      return { key: "compare.note.missing", params: { expected } };
    case "extra-content":
      return { key: stillCounts ? "compare.note.extraStill" : "compare.note.extra", params: { said } };
    case "missing-short":
      return { key: "compare.note.shortLeft", params: { expected } };
    case "extra-short":
      return { key: "compare.note.shortAdded", params: { said } };
  }
}

export function SentenceFeedback({ target, attempt, matchOptions, kind }: SentenceFeedbackProps) {
  const t = useT();
  const tEnglish = useTWithEnglish();
  const comparison = compareSentence(target, attempt.transcript, matchOptions);
  const typed = kind === "writing" || attempt.input === "typed";
  const Icon = attempt.isCorrect ? CheckIcon : ReviewIcon;
  const heading = useRef<HTMLHeadingElement>(null);
  // The result appears after a button press: move focus to it so it is read first.
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const empty = attempt.transcript.trim() === "";
  // When it does not count, only the lines that explain why: "this still counts" next to "Not yet" confuses.
  const shown = attempt.isCorrect
    ? comparison.notes
    : comparison.notes.filter((n) => n.kind === "missing-content" || n.kind === "different" || n.kind === "extra-content");
  const noteLines = shown.map((note) => lineFor(note, typed, attempt.isCorrect));
  return (
    <section className={attempt.isCorrect ? "panel panel--correct" : "panel panel--wrong"}>
      {/* A big headline first ("This counts." / "Not yet."), then the reason lines, then the details. */}
      <h2 className="result-headline" ref={heading} tabIndex={-1}>
        <Icon className={attempt.isCorrect ? "icon-inline" : "icon-inline icon-inline--attention"} />{" "}
        {attempt.isCorrect ? t("compare.counts") : t("compare.notYet")}
      </h2>
      {empty ? (
        <p>{t("voice.nothingHeard")}</p>
      ) : (
        <ul className="plain-lines result-reason">
          {attempt.isCorrect && noteLines.every((l) => l.key.startsWith("compare.note.short")) && (
            <li>{t("compare.why.allWords")}</li>
          )}
          {noteLines.map((line, index) => (
            <li key={index}>{tEnglish(line.key, line.params)}</li>
          ))}
        </ul>
      )}
      {!(empty && typed) && <p className="note">{typed ? t("compare.honest.typed") : t("compare.honest.heard")}</p>}
      <p className="progress-line">{t("compare.wanted")}</p>
      <p lang="en">{target}</p>
      <p className="progress-line">{typed ? t("compare.typed") : t("compare.heard")}</p>
      <p lang="en">{empty ? "…" : attempt.transcript}</p>
      {attempt.assisted && <p className="note">{t("partReport.assisted")}</p>}
      <p className="note"><LegalText messageKey="compare.setting" /></p>
      {kind === "writing" && (
        <p className="note">
          <LegalText messageKey="compare.setting.writing" />
        </p>
      )}
    </section>
  );
}
