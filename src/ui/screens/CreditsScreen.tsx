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
        Headings use the Bitter font by Sol Matas (Huerta Tipográfica), under the{" "}
        <a href="/fonts/OFL.txt" target="_blank" rel="noopener noreferrer">
          {OFL_NAME}
        </a>
        .
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
