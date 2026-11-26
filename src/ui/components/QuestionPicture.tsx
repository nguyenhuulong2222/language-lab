/**
 * A picture for a civics question, with a short caption (ours, or the source's own title).
 *
 * Shown only after an answer is graded (the feedback panel) and in "Study first". Never render
 * it in a question view: a picture can give the answer away (spec BS-20). The caption, the
 * creator and the date stay in English.
 *
 * QuestionIllustration is the same for an AI illustration of a CONCEPT question. It always shows
 * the visible label "AI-generated illustration" (a legal line: English until the language is
 * reviewed) above the caption, and it is only ever given a reviewed entry
 * (illustrationForQuestion in src/engine/illustrations.ts).
 */
import { illustrationUrl, type IllustrationEntry } from "../../engine/illustrations";
import { pictureUrl, type PictureEntry } from "../../engine/question-images";
import { LegalText } from "./LegalText";
import "./QuestionPicture.css";
export function QuestionPicture({ picture }: { picture: PictureEntry }) {
  return (
    <figure className="question-picture" lang="en">
      <img
        className="question-picture__image"
        src={pictureUrl(picture)}
        alt={picture.alt}
        width={picture.width}
        height={picture.height}
        loading="lazy"
        decoding="async"
      />
      <figcaption className="question-picture__caption">
        {picture.caption}
        <span className="question-picture__credit">
          {" "}
          {/* A diagram's credit line is the whole credit ("Drawn from U.S. Census Bureau data"). */}
          {picture.kind === "diagram" ? `(${picture.creator})` : `(${picture.creator}, ${picture.date})`}
        </span>
      </figcaption>
    </figure>
  );
}
export function QuestionIllustration({ illustration }: { illustration: IllustrationEntry }) {
  // Defence in depth: the engine already returns reviewed entries only.
  if (illustration.reviewed !== true) return null;
  return (
    <figure className="question-picture question-picture--ai">
      <img
        className="question-picture__image"
        src={illustrationUrl(illustration)}
        alt={illustration.alt}
        lang="en"
        width={illustration.width}
        height={illustration.height}
        loading="lazy"
        decoding="async"
      />
      <figcaption className="question-picture__caption">
        <span className="question-picture__label">
          <LegalText messageKey="illustration.label" />
          <span className="ll-sr-only">: </span>
        </span>
        <span lang="en">{illustration.caption}</span>
      </figcaption>
    </figure>
  );
}
