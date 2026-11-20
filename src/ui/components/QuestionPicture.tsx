/**
 * A picture for a civics question, with the source's own title as the caption.
 *
 * Shown only after an answer is graded (the feedback panel) and in "Study first". Never render
 * it in a question view: a picture can give the answer away (spec BS-20). The caption, the
 * creator and the date come from the source record and stay in English.
 */
import { pictureUrl, type PictureEntry } from "../../engine/question-images";
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
          {picture.creator}, {picture.date}
        </span>
      </figcaption>
    </figure>
  );
}
