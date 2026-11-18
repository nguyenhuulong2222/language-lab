/**
 * Picture credits: every picture used in civics practice, with its creator, date, source page and
 * the rights statement of the source, word for word (spec BS-20). Opened from the footer.
 */
import { PICTURE_MANIFEST, type PictureManifest } from "../../engine/question-images";
import { useT } from "../../i18n/react";
import { Disclaimer } from "../components/Disclaimer";
import { TakeHeader } from "../components/TakeHeader";
import "../components/Screen.css";

export function CreditsScreen({ onClose, manifest = PICTURE_MANIFEST }: { onClose: () => void; manifest?: PictureManifest }) {
  const t = useT();
  return (
    <div className="screen">
      <TakeHeader stage="home" title={t("credits.title")} lead={t("credits.lead")} />
      <ul className="credit-list" lang="en">
        {manifest.images.map((p) => (
          <li key={p.id} className="credit-list__item">
            <h2 className="panel__title">{p.title}</h2>
            <p className="note">
              {p.creator}, {p.date}
            </p>
            <p className="note">
              <a href={p.sourcePageUrl} rel="noreferrer">
                {p.sourcePageUrl}
              </a>
            </p>
            <p className="note">“{p.rights}”</p>
          </li>
        ))}
      </ul>
      <Disclaimer messageKey="disclaimer.short" />
      <div className="btn-row">
        <button type="button" className="btn" onClick={onClose}>
          {t("credits.back")}
        </button>
      </div>
    </div>
  );
}
