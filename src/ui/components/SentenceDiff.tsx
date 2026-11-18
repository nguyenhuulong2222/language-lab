/**
 * Shows the comparison of a sentence with an answer, word by word. Each word that is not a
 * match carries a text label for screen readers and a visual mark that is not only colour:
 * a dashed outline for a missing word, a line through an extra word.
 */
import type { DiffWord } from "../../engine/sentence-compare";
import { useT } from "../../i18n/react";
import "./SentenceDiff.css";

export function SentenceDiff({ diff }: { diff: readonly DiffWord[] }) {
  const t = useT();
  return (
    <div>
      <p className="diff" lang="en">
        {diff.map((item, index) => (
          <span key={index} className={`diff__word diff__word--${item.status}`}>
            {index > 0 && " "}
            {item.status !== "match" && (
              <span className="ll-sr-only">
                {item.status === "missing" ? t("compare.word.missing") : t("compare.word.extra")}:{" "}
              </span>
            )}
            {item.word}
          </span>
        ))}
      </p>
      <p className="note">{t("compare.legend")}</p>
    </div>
  );
}
