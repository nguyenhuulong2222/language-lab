/**
 * Setup: asks only for what the chosen part needs. A fictional profile (N-400, full interview)
 * and whether the N-400 was filed before, or on or after, the boundary date from the rules
 * (civics, full interview). The engine turns that into the 2008 or the 2025 test. The screen
 * never asks for real data, with one narrow exception (decisions log S): "Use my name" asks for the
 * learner's own name only. The name stays in memory on this device, is handed to `onStart` and kept
 * by the app's state; it is never stored, put in the URL, logged or sent. Every other answer then
 * comes from a sample profile. Reading and writing have no setup at all.
 */
import { LegalText } from "../components/LegalText";
import { useId, useState } from "react";
import { checkOwnName, OWN_NAME_MAX } from "../../engine/own-name";
import type { AgeException, FiledChoice } from "../../engine/practice-flow";
import type { MessageKey } from "../../i18n";
import type { PracticeProfile } from "../../engine/practice-content";
import { useLanguage, useT } from "../../i18n/react";
import { ScreenHelp } from "../components/ScreenHelp";
import { TakeHeader } from "../components/TakeHeader";
import { formatDate } from "../format";
import type { CivicsPracticeRules } from "../../engine/test-rules-loader";
import { EXCEPTIONS_URL, SpecialConsiderationNote } from "../components/SpecialConsiderationNote";
import "../components/Screen.css";

interface IntroScreenProps {
  profiles: readonly PracticeProfile[];
  /** The first filing date that uses the 2025 test (from data/test-rules.json). */
  boundaryDate: string;
  /** What the chosen part needs the user to choose. */
  needs: { profile: boolean; filing: boolean };
  /** `ownName` is set only for "Use my name"; `profileId` is then the sample profile's. */
  onStart: (choice: { profileId?: string; ownName?: string; filedOn?: FiledChoice; exception?: AgeException }) => void;
  /** The sample profile behind "Use my name"; without it the card is not offered. */
  ownNameBaseProfileId?: string;
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
/** The radio value of the "Use my name" card (not a profile id). */
const OWN = "own-name";
const NAME_PROBLEM: Record<"empty" | "tooLong" | "characters", MessageKey> = {
  empty: "intro.ownName.error.empty",
  tooLong: "intro.ownName.error.tooLong",
  characters: "intro.ownName.error.characters",
};
export function IntroScreen({ profiles, boundaryDate, needs, onStart, exceptions, ownNameBaseProfileId, focusOnFirstRender = true }: IntroScreenProps) {
  const t = useT();
  const language = useLanguage();
  const [profileId, setProfileId] = useState<string | null>(null);
  // The learner's own name: React state only (decisions log S).
  const [nameText, setNameText] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const nameId = useId();
  const ownChosen = profileId === OWN && ownNameBaseProfileId !== undefined;
  const nameCheck = checkOwnName(nameText);
  const [presses, setPresses] = useState(0);
  const [filedOn, setFiledOn] = useState<FiledChoice | null>(null);
  const [exception, setException] = useState<AgeException>(exceptions?.initial ?? "none");
  const showWho = needs.filing && exceptions !== undefined;
  const date = formatDate(boundaryDate, language);
  const profileReady = profileId !== null && (profileId !== OWN || (ownChosen && nameCheck.ok));
  const ready = (!needs.profile || profileReady) && (!needs.filing || filedOn !== null);

  const start = () => {
    if (!ready) return;
    onStart({
      ...(needs.profile && profileId !== null && profileId !== OWN ? { profileId } : {}),
      ...(needs.profile && ownChosen && nameCheck.ok ? { profileId: ownNameBaseProfileId, ownName: nameCheck.name } : {}),
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
              {ownNameBaseProfileId !== undefined && (
                <label className="choice">
                  <input
                    className="choice__input"
                    type="radio"
                    name="profile"
                    value={OWN}
                    checked={profileId === OWN}
                    onChange={() => setProfileId(OWN)}
                  />
                  <span className="choice__text">
                    <span>{t("intro.profile.own.title")}</span>
                    <span className="choice__sub">{t("intro.profile.own.sub")}</span>
                  </span>
                </label>
              )}
              {ownChosen && (
                <div className="field">
                  <label className="field__label" htmlFor={nameId}>
                    {t("intro.ownName.label")}
                  </label>
                  {/* No form element, no autocomplete and no spell check: the browser keeps or sends nothing. */}
                  <input
                    id={nameId}
                    className="field__input"
                    type="text"
                    name="own-name"
                    required
                    aria-required="true"
                    aria-invalid={nameTouched && !nameCheck.ok}
                    aria-describedby={`${nameId}-privacy${nameTouched && !nameCheck.ok ? ` ${nameId}-error` : ""}`}
                    maxLength={OWN_NAME_MAX}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={nameText}
                    onChange={(event) => {
                      setNameText(event.target.value);
                      setNameTouched(true);
                    }}
                    onBlur={() => setNameTouched(true)}
                  />
                  {nameTouched && !nameCheck.ok && (
                    <p id={`${nameId}-error`} className="status status--attention" role="alert">
                      {t(NAME_PROBLEM[nameCheck.problem], { max: OWN_NAME_MAX })}
                    </p>
                  )}
                  <p id={`${nameId}-privacy`} className="note field__hint">
                    <LegalText messageKey="intro.ownName.privacy" />
                  </p>
                </div>
              )}
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
              <LegalText messageKey="home.exceptions.timing" />
            </p>
            <p className="note">
              <a className="special-note__link" href={EXCEPTIONS_URL} target="_blank" rel="noopener noreferrer">
                {t("special.language.link")}
                <span className="ll-sr-only"> {t("common.newTab")}</span>
              </a>
            </p>
            {exception === "65/20" && exceptions.special !== null && <SpecialConsiderationNote rules={exceptions.special} languageLine={false} />}
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
              if (profileId === OWN) setNameTouched(true);
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
