/**
 * Intro: choose a fictional profile and whether the N-400 was filed before, or on or after,
 * the boundary date from the rules. The engine turns that into the 2008 or the 2025 test.
 * Disclaimers are shown here. The screen never asks for real data.
 */
import { useState } from "react";
import type { FiledChoice } from "../../engine/practice-flow";
import type { PracticeProfile } from "../../engine/practice-content";
import { useT } from "../../i18n/react";
import { Disclaimer } from "../components/Disclaimer";
import { TakeHeader } from "../components/TakeHeader";
import { formatDate } from "../format";
import "../components/Screen.css";

interface IntroScreenProps {
  profiles: readonly PracticeProfile[];
  /** The first filing date that uses the 2025 test (from data/test-rules.json). */
  boundaryDate: string;
  /** True when this build cannot score civics (answer key not yet reviewed). */
  civicsLocked: boolean;
  onStart: (profileId: string, filedOn: FiledChoice) => void;
}

export function IntroScreen({ profiles, boundaryDate, civicsLocked, onStart }: IntroScreenProps) {
  const t = useT();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [filedOn, setFiledOn] = useState<FiledChoice | null>(null);
  const date = formatDate(boundaryDate);
  const ready = profileId !== null && filedOn !== null;

  return (
    <div className="screen">
      <TakeHeader stage="intro" title={t("intro.title")} lead={t("intro.lead")} focusOnFirstRender={false} />

      <Disclaimer variant="prominent" id="intro-disclaimer" text={t("disclaimer.full")} />
      <ul className="notice-list">
        <li>{t("intro.notice.practice")}</li>
        <li>{t("intro.notice.legal")}</li>
        <li>{t("intro.notice.government")}</li>
      </ul>
      <p className="note">{t("intro.privacy")}</p>

      <div className="screen__body">
        <fieldset className="choices">
          <legend className="choices__legend">{t("intro.profile.legend")}</legend>
          <p className="note">{t("intro.profile.help")}</p>
          {profiles.map((profile) => (
            <label key={profile.id} className="choice">
              <input
                className="choice__input"
                type="radio"
                name="profile"
                value={profile.id}
                checked={profileId === profile.id}
                onChange={() => setProfileId(profile.id)}
              />
              <span className="choice__text">
                <span>{profile.displayName}</span>
                <span className="choice__sub">{t("common.fictional")}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="choices">
          <legend className="choices__legend">{t("intro.filed.legend")}</legend>
          <p className="note">{t("intro.filed.help")}</p>
          {(["before", "on_or_after"] as const).map((choice) => (
            <label key={choice} className="choice">
              <input
                className="choice__input"
                type="radio"
                name="filed"
                value={choice}
                checked={filedOn === choice}
                onChange={() => setFiledOn(choice)}
              />
              <span className="choice__text">
                {choice === "before" ? t("intro.filed.before", { date }) : t("intro.filed.onOrAfter", { date })}
              </span>
            </label>
          ))}
        </fieldset>

        <p className="note">{t("voice.privacy")}</p>
        {civicsLocked && <p className="status status--attention">{t("intro.locked")}</p>}

        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={!ready}
            aria-describedby="intro-start-hint"
            onClick={() => ready && onStart(profileId, filedOn)}
          >
            {t("intro.start")}
          </button>
        </div>
        <p id="intro-start-hint" className="status">
          {ready ? "" : t("intro.startHint")}
        </p>
      </div>
    </div>
  );
}
