/**
 * Picture credits: every picture used in civics practice, with its creator, date, source page and
 * the rights statement of the source, word for word (spec BS-20). Opened from the footer.
 */
import { LegalText } from "../components/LegalText";
import { PICTURE_MANIFEST, type PictureManifest } from "../../engine/question-images";
import { useT } from "../../i18n/react";
import { Disclaimer } from "../components/Disclaimer";
import { TakeHeader } from "../components/TakeHeader";
import "../components/Screen.css";

/** Proper names, shown in English whatever the interface language. */
const OFL_NAME = "SIL Open Font License 1.1";
// Font and licence names, the same in every language (the paragraph is lang="en").
const PLAYFAIR_LICENCE = "Playfair Display licence";
const SOURCE_SERIF_LICENCE = "Source Serif 4 licence";
export function CreditsScreen({ onClose, manifest = PICTURE_MANIFEST }: { onClose: () => void; manifest?: PictureManifest }) {
  const t = useT();
  return (
    <div className="screen">
      <TakeHeader stage="home" title={t("credits.title")} lead={<LegalText messageKey="credits.lead" />} />
      <p className="note">{t("credits.newTab")}</p>
      <ul className="credit-list" lang="en">
        {manifest.images.map((p) => (
          <li key={p.id} className="credit-list__item">
            <h2 className="panel__title">{p.title}</h2>
            <p className="note">
              {p.creator}, {p.date}
            </p>
            <p className="note">
              <a href={p.sourcePageUrl} target="_blank" rel="noopener noreferrer">
                {t("credits.sourceLink", { title: p.title })}
              </a>
            </p>
            <p className="note">“{p.rights}”</p>
          </li>
        ))}
      </ul>
      <p className="note credit-font" lang="en">
        Headings use Playfair Display by Claus Eggers Sørensen, and the text uses Source Serif 4 by
        Frank Grießhammer (Adobe), both under the {OFL_NAME} (
        <a href="/fonts/OFL-PlayfairDisplay.txt" target="_blank" rel="noopener noreferrer">
          {PLAYFAIR_LICENCE}
        </a>
        ,{" "}
        <a href="/fonts/OFL-SourceSerif4.txt" target="_blank" rel="noopener noreferrer">
          {SOURCE_SERIF_LICENCE}
        </a>
        ).
      </p>
      <Disclaimer messageKey="disclaimer.short" />
      <div className="btn-row">
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {t("credits.back")}
        </button>
      </div>
    </div>
  );
}
