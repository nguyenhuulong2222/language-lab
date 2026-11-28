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
import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { illustrationUrl, type IllustrationEntry } from "../../engine/illustrations";
import { pictureUrl, type PictureEntry } from "../../engine/question-images";
import { useT } from "../../i18n/react";
import { MagnifierIcon } from "./icons";
import { LegalText } from "./LegalText";
import "./QuestionPicture.css";

/**
 * The history entry of an open picture. It also carries the section flag, so a reload while the
 * picture is open is cleaned up like any section entry, and section-history ignores the Back that
 * leaves it (that Back lands on the section entry).
 */
const PICTURE_STATE = { languageLabSection: true, languageLabPicture: true } as const;
/** On <html> while a picture is open: the page behind does not scroll. */
const OPEN_CLASS = "ll-picture-open";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  /** True while this picture's history entry is in the history. */
  const entry = useRef(false);
  const captionId = useId();
  const dialogCaptionId = useId();

  const onPop = useCallback(() => {
    // Back: the browser has already taken the entry away.
    entry.current = false;
    dialogRef.current?.close();
  }, []);

  /** Runs on every way out (Close, Esc, the backdrop, Back): one place undoes everything open() did. */
  const onClosed = useCallback(() => {
    window.removeEventListener("popstate", onPop);
    document.documentElement.classList.remove(OPEN_CLASS);
    if (entry.current) {
      entry.current = false;
      // The popstate this causes lands on the section entry, which section-history ignores.
      window.history.back();
    }
    openerRef.current?.focus();
  }, [onPop]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    dialog.addEventListener("close", onClosed);
    return () => {
      dialog.removeEventListener("close", onClosed);
      // Unmounted while open (the screen changed): leave no entry and no lock behind.
      window.removeEventListener("popstate", onPop);
      document.documentElement.classList.remove(OPEN_CLASS);
      if (entry.current) {
        entry.current = false;
        window.history.back();
      }
    };
  }, [onClosed, onPop]);

  const open = () => {
    const dialog = dialogRef.current;
    if (dialog === null || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    document.documentElement.classList.add(OPEN_CLASS);
    window.history.pushState(PICTURE_STATE, "");
    entry.current = true;
    window.addEventListener("popstate", onPop);
    closeRef.current?.focus();
  };

  const close = () => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (typeof dialog.close === "function" && typeof dialog.showModal === "function") dialog.close();
    else {
      // Browsers without <dialog> support: close by hand and run the same clean-up.
      dialog.removeAttribute("open");
      onClosed();
    }
  };

  return (
    <figure className={figureClass === undefined ? "question-picture" : `question-picture ${figureClass}`}>
      <button
        ref={openerRef}
        type="button"
        className="question-picture__button"
        aria-label={t("picture.zoom.label")}
        aria-describedby={captionId}
        aria-haspopup="dialog"
        onClick={open}
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
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="picture-dialog__bar">
          <button ref={closeRef} type="button" className="btn btn--primary picture-dialog__close" onClick={close}>
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
