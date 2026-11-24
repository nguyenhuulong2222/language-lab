# Release finish — Design
Implements `requirements.md` revision 1.

## Step 1 — 65/20 practice
- **Rules.** `test-rules-loader.ts`: `specialConsiderationRules(rules)` returns a `CivicsTestRules`
  (`questionPoolSize` = `questionBank`, `questionsAsked`, `passingScore`, and the two early-stop
  values as stored, possibly `null`), or `null` when REQ-S02's three fields are not verified.
  `CivicsTestRules.earlyStopOn*` may now hold `null`; the 2008 and 2025 values stay required and
  verified, so their behaviour is unchanged.
- **Grader.** `runCivicsStage`: a `null` early-stop value never stops the stage. When every question
  of the limit is scored without a stop, `stopReason` is `"all_asked"` and `passed` is
  `correctCount >= passingScore`. Part report and final report accept `"all_asked"`.
- **Designated set.** `src/engine/special-consideration.ts` loads `data/civics-65-20.json` and
  returns the ids per version. Pure.
- **Flow.** `PracticeState.specialConsideration` (set by `choose` from the home card and by `start`
  from the checkbox; only for modes with civics). `begin` draws from the designated static questions;
  every civics rule lookup goes through one `civicsRulesFor(state)`.
- **Env.** `PracticeEnv.specialRules?(version)` and `designated?(version)`; absent or `null` means
  the mode is off. `createDefaultPracticeEnv` uses the loader: in production the gate in REQ-S02
  decides; in development the mode is on.
- **UI.** IntroScreen checkbox (only when `needs.filing` and the mode is offered), with the help line
  and the language line + link. Home: a card under "Study first". Study first: a "65/20 questions
  only" checkbox on the version choice. CivicsScreen and the part report name the 65/20 practice.
- **Contracts.** No change to `src/contracts/`: the final report keeps its shape; the summary text
  says "65/20".
