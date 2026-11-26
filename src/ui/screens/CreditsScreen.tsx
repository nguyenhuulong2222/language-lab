/**
 * Picture credits: every picture used in civics practice, with its creator, date, source page and
 * the rights statement of the source, word for word (spec BS-20), then the reviewed AI
 * illustrations under their own heading, each with the model that made it. Opened from the footer.
 */
import { LegalText } from "../components/LegalText";
import { ILLUSTRATIONS, type IllustrationManifest } from "../../engine/illustrations";
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
export function CreditsScreen({
  onClose,
  manifest = PICTURE_MANIFEST,
  illustrations = ILLUSTRATIONS,
}: {
  onClose: () => void;
  manifest?: PictureManifest;
  illustrations?: IllustrationManifest;
}) {
  const t = useT();
  // Only the illustrations the owner reviewed are ever shown, so only those are listed.
  const shown = illustrations.images.filter((e) => e.reviewed === true && e.source === "ai");
  return (
    <div className="screen">
      <TakeHeader stage="home" title={t("credits.title")} lead={<LegalText messageKey="credits.lead" />} />
      <p className="note">{t("credits.newTab")}</p>
      <h2 className="panel__title">{t("credits.photos.title")}</h2>
      <ul className="credit-list" lang="en">
        {manifest.images.map((p) => (
          <li key={p.id} className="credit-list__item">
            <h3 className="panel__title">{p.title}</h3>
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
      {shown.length > 0 && (
        <section aria-labelledby="credits-ai">
          <h2 className="panel__title" id="credits-ai">
            <LegalText messageKey="credits.ai.title" />
          </h2>
          <p className="note">
            <LegalText messageKey="credits.ai.lead" />
          </p>
          <ul className="credit-list">
            {shown.map((e) => (
              <li key={e.id} className="credit-list__item">
                <h3 className="panel__title" lang="en">
                  {e.caption}
                </h3>
                <p className="note">
                  <LegalText messageKey="credits.ai.made" params={{ model: e.model, date: e.date }} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
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
