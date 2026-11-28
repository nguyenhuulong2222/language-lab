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
 *
 * Every picture (federal picture, diagram, AI illustration) fills the content column and is a
 * button: a tap opens the same file full screen in a native modal <dialog>, with the caption and
 * the credit under it. The dialog closes with Close, Esc, a tap outside the picture, or Back: it
 * adds one history entry when it opens and takes it away again when it closes, so the section's
 * own Back handling (src/ui/section-history.ts) is not disturbed. Pinch-zoom is never blocked.
 */
import { useId, type ReactNode } from "react";
import { illustrationUrl, type IllustrationEntry } from "../../engine/illustrations";
import { pictureUrl, type PictureEntry } from "../../engine/question-images";
import { useT } from "../../i18n/react";
import { MagnifierIcon } from "./icons";
import { LegalText } from "./LegalText";
import { useModalDialog } from "./use-modal-dialog";
import "./QuestionPicture.css";

/** The history entry of an open picture (with the section flag: see use-modal-dialog.ts). */
const PICTURE_STATE = { languageLabSection: true, languageLabPicture: true } as const;

interface ZoomablePictureProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Language of the alt text (English). */
  altLang: string;
  /** Extra class of the figure. */
  figureClass?: string;
  /** The caption and credit, shown under the picture and again in the full-screen view. */
  caption: ReactNode;
}

function ZoomablePicture({ src, alt, width, height, altLang, figureClass, caption }: ZoomablePictureProps) {
  const t = useT();
  const { dialogRef, closeRef, open, close, onDialogClick } = useModalDialog(PICTURE_STATE);
  const captionId = useId();
  const dialogCaptionId = useId();

  return (
    <figure className={figureClass === undefined ? "question-picture" : `question-picture ${figureClass}`}>
      <button
        type="button"
        className="question-picture__button"
        aria-label={t("picture.zoom.label")}
        aria-describedby={captionId}
        aria-haspopup="dialog"
        onClick={(event) => open(event.currentTarget)}
      >
        <img
          className="question-picture__image"
          src={src}
          alt={alt}
          lang={altLang}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
        />
        <span className="question-picture__zoom" aria-hidden="true">
          <MagnifierIcon className="question-picture__zoom-icon" />
        </span>
      </button>
      <p className="question-picture__hint">
        {t("picture.zoom.hint")}
      </p>
      <figcaption id={captionId} className="question-picture__caption">
        {caption}
      </figcaption>
      <dialog
        ref={dialogRef}
        className="picture-dialog"
        aria-labelledby={dialogCaptionId}
        // A tap outside the picture and its caption (the dark backdrop) closes it.
        onClick={onDialogClick}
      >
        <div className="picture-dialog__bar">
          <button ref={closeRef} type="button" className="btn btn--primary picture-dialog__close" onClick={() => close()}>
            {t("picture.zoom.close")}
          </button>
        </div>
        <img className="picture-dialog__image" src={src} alt={alt} lang={altLang} width={width} height={height} loading="lazy" decoding="async" />
        <div id={dialogCaptionId} className="picture-dialog__caption">
          {caption}
        </div>
      </dialog>
    </figure>
  );
}

export function QuestionPicture({ picture }: { picture: PictureEntry }) {
  return (
    <ZoomablePicture
      src={pictureUrl(picture)}
      alt={picture.alt}
      width={picture.width}
      height={picture.height}
      altLang="en"
      caption={
        <span lang="en">
          {picture.caption}
          <span className="question-picture__credit">
            {" "}
            {/* A diagram's credit line is the whole credit ("Drawn from U.S. Census Bureau data"). */}
            {picture.kind === "diagram" ? `(${picture.creator})` : `(${picture.creator}, ${picture.date})`}
          </span>
        </span>
      }
    />
  );
}

export function QuestionIllustration({ illustration }: { illustration: IllustrationEntry }) {
  // Defence in depth: the engine already returns reviewed entries only.
  if (illustration.reviewed !== true) return null;
  return (
    <ZoomablePicture
      src={illustrationUrl(illustration)}
      alt={illustration.alt}
      width={illustration.width}
      height={illustration.height}
      altLang="en"
      figureClass="question-picture--ai"
      caption={
        <>
          <span className="question-picture__label">
            <LegalText messageKey="illustration.label" />
            <span className="ll-sr-only">: </span>
          </span>
          <span lang="en">{illustration.caption}</span>
        </>
      }
    />
  );
}
