/**
 * Setup: asks only for what the chosen part needs. A fictional profile (N-400, full interview)
 * and whether the N-400 was filed before, or on or after, the boundary date from the rules
 * (civics, full interview). The engine turns that into the 2008 or the 2025 test. The screen
 * never asks for real data. Reading and writing have no setup at all.
 */
import { LegalText } from "../components/LegalText";
import { useState } from "react";
import type { AgeException, FiledChoice } from "../../engine/practice-flow";
import type { MessageKey } from "../../i18n";
import type { PracticeProfile } from "../../engine/practice-content";
import { useLanguage, useT } from "../../i18n/react";
import { ScreenHelp } from "../components/ScreenHelp";
import { TakeHeader } from "../components/TakeHeader";
import { formatDate } from "../format";
import type { CivicsPracticeRules } from "../../engine/test-rules-loader";
import { SpecialConsiderationNote } from "../components/SpecialConsiderationNote";
import "../components/Screen.css";

interface IntroScreenProps {
  profiles: readonly PracticeProfile[];
  /** The first filing date that uses the 2025 test (from data/test-rules.json). */
  boundaryDate: string;
  /** What the chosen part needs the user to choose. */
  needs: { profile: boolean; filing: boolean };
  onStart: (choice: { profileId?: string; filedOn?: FiledChoice; exception?: AgeException }) => void;
  /**
   * Who is practicing (decisions log Q): shown with the filing choice for parts with civics,
   * pre-filled from Home. `special` is the 65/20 rules when the build offers 65/20 (its card and
   * note are shown only then).
   */
  exceptions?: { initial: AgeException; special: CivicsPracticeRules | null };
  /** True when the setup appears again after "start over": focus then moves to its heading. */
  focusOnFirstRender?: boolean;
}

const WHO: ReadonlyArray<{ value: AgeException; title: MessageKey }> = [
  { value: "none", title: "home.who.most.title" },
  { value: "50/20", title: "home.who.5020.title" },
  { value: "55/15", title: "home.who.5515.title" },
  { value: "65/20", title: "home.who.special.title" },
];
export function IntroScreen({ profiles, boundaryDate, needs, onStart, exceptions, focusOnFirstRender = true }: IntroScreenProps) {
  const t = useT();
  const language = useLanguage();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [presses, setPresses] = useState(0);
  const [filedOn, setFiledOn] = useState<FiledChoice | null>(null);
  const [exception, setException] = useState<AgeException>(exceptions?.initial ?? "none");
  const showWho = needs.filing && exceptions !== undefined;
  const date = formatDate(boundaryDate, language);
  const ready = (!needs.profile || profileId !== null) && (!needs.filing || filedOn !== null);

  const start = () => {
    if (!ready) return;
    onStart({
      ...(needs.profile && profileId !== null ? { profileId } : {}),
      ...(needs.filing && filedOn !== null ? { filedOn } : {}),
      ...(showWho && exception !== "none" ? { exception } : {}),
    });
  };

  return (
    <div className="screen">
      <TakeHeader stage="intro" title={t("setup.title")} lead={t("setup.lead")} focusOnFirstRender={focusOnFirstRender} />

      <ScreenHelp screen="setup" />

      <div className="screen__body">
        {needs.profile && (
          <>
            <p className="note"><LegalText messageKey="intro.privacy" /></p>
            <p className="note"><LegalText messageKey="coach.privacy" /></p>
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
                    <span lang="en">{profile.displayName}</span>
                    <span className="choice__sub">{t("common.fictional")}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </>
        )}

        {needs.filing && (
          <fieldset className="choices">
            <legend className="choices__legend">{t("intro.filed.legend")}</legend>
            <p className="note"><LegalText messageKey="intro.filed.help" /></p>
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
        )}
        {showWho && (
          <fieldset className="choices" aria-describedby="intro-who-help">
            <legend className="choices__legend">{t("intro.who.legend")}</legend>
            {WHO.filter((w) => w.value !== "65/20" || exceptions.special !== null).map((w) => (
              <label key={w.value} className="choice">
                <input
                  className="choice__input"
                  type="radio"
                  name="exception"
                  value={w.value}
                  checked={exception === w.value}
                  onChange={() => setException(w.value)}
                />
                <span className="choice__text">{t(w.title)}</span>
              </label>
            ))}
            <p className="note" id="intro-who-help">
              <LegalText messageKey="home.exceptions.timing" /> <LegalText messageKey="special.englishExempt" />
            </p>
            {exception === "65/20" && exceptions.special !== null && <SpecialConsiderationNote rules={exceptions.special} />}
          </fieldset>
        )}
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--primary"
            aria-disabled={!ready}
            aria-describedby="intro-start-hint"
            onClick={() => {
              if (!ready) setPresses((n) => n + 1);
              start();
            }}
          >
            {t("intro.start")}
          </button>
        </div>
        {/* A new element after each press, so a screen reader announces the hint again. */}
        <p id="intro-start-hint" key={presses} className="status" role={presses > 0 && !ready ? "alert" : undefined}>
          {ready ? "" : t("intro.startHint")}
        </p>
      </div>
    </div>
  );
}
