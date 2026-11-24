# Release finish — Requirements
Status: revision 1 (branch `release/finish`, 2026-11-20). Steps 1 to 5 of the owner's brief. Each
step is updated here before it is built.

## Step 1 — 65/20 practice (closes CON-09)

### Sources (saved in `data/sources/`, SHA-256 in `data/sources/README.md`)
USCIS Policy Manual, Vol. 12, Part E, Ch. 2, Section E.2 "Special Consideration"
(https://www.uscis.gov/policy-manual/volume-12-part-e-chapter-2, saved as
`uscis-policy-manual-vol12-parte-ch2.html`; the sentences are copied to `uscis-65-20-passages.txt`):

> An officer gives special consideration to an alien who is 65 years of age or older and who has
> been living in the United States for periods totaling at least 20 years subsequent to a lawful
> admission for permanent residence. The age and time requirements must be met at the time of
> filing the naturalization application.
>
> The bank of civics test questions for aliens given special consideration contains 20 specially
> designated civics questions to study. The civics test for aliens given special consideration
> contains 10 questions.
>
> Aliens who filed a naturalization application before October 20, 2025, are given a 10-question
> test from the 20 specially designated questions on the 2008 Naturalization Civics Test.
>
> Aliens who file a naturalization application on or after October 20, 2025, are given a
> 10-question test from the 20 specially designated questions on the 2025 Naturalization Civics Test.
>
> An alien who meets the criteria for special consideration passes the civics test if he or she
> provides a correct answer or provides an alternative phrasing of the correct answer for at least
> six of 10 civics test questions from the specially designated list of 20 questions.

The same chapter's table: "Still required but officers administer specially designated test forms.
Aliens may take the civics test in their language of choice using an interpreter."

Study for the Test (https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test,
`uscis-study-for-the-test.html`):

> If you are 65 years old or older and have been living in the United States as a lawful permanent
> resident of the United States for 20 or more years, USCIS will continue to administer a test with
> 10 questions from a specially selected bank of 20 test questions from either the 2008 or 2025
> Naturalization Civics Test. You may study just the 20 questions that have been marked with an
> asterisk (*). You may also take the naturalization test in the language of your choice.

Exceptions and Accommodations (https://www.uscis.gov/citizenship/exceptions-and-accommodations,
`uscis-exceptions-and-accommodations.html`):

> You will be permitted to take the civics test in your native language. If you take the test in
> your native language, you must bring an interpreter with you to your interview.

The official 2025 list (`uscis-2025-civics-128.pdf`, page 1): "The USCIS officer will ask you to
answer 10 out of the 20 civics test questions with an asterisk. You must answer at least 6 out of
10 questions (or 60%) correctly to pass the 2025 version of the civics test." The 2008 text
(`uscis-2008-civics-100-rev0119.txt`, line 12): "you may study just the questions that have been
marked with an asterisk."

The 2025 Civics Test page
(https://www.uscis.gov/citizenship-resource-center/naturalization-test-and-study-resources/2025-civics-test,
`uscis-2025-civics-test.html`, "Last Reviewed/Updated: 09/17/2025") states no 65/20 rule.

**No source states an early-stop rule for the 65/20 test.** The 2008 and 2025 stop rules are stated
for the standard tests only.

### Requirements
- **REQ-S01 Values.** `data/test-rules.json` `65_20_specialConsideration`: `questionBank` 20,
  `questionsAsked` 10, `passingScore` 6, each with the Policy Manual sentence as `sourceQuote`.
  `earlyStopOnCorrect` and `earlyStopOnIncorrect` stay `null` with `needsVerification: true`.
- **REQ-S02 Gate.** The 65/20 mode is offered only when `questionBank`, `questionsAsked` and
  `passingScore` are verified (`needsVerification: false`, a value and a quote). Otherwise it is off
  in every build (no home card, no setup choice, no Study first option); the rules file alone decides.
  The early-stop values are not needed: with no sourced stop rule the practice asks all 10.
- **REQ-S03 Designated set.** `data/civics-65-20.json` lists the 20 designated question ids per
  version. A data test checks that it equals the asterisked questions in the 2025 text, the 2008
  web page and the 2008 text, and that every id is in the answer key. The answer keys and their
  review record are not changed.
- **REQ-S04 Engine.** A setup flag `specialConsideration`. With it, the civics part draws 10
  questions from the designated static questions (dynamic questions are never practised, CR-003),
  scores them against the same answer key, and gives the practice score when at least 6 of the 10
  are correct after all 10 are asked. No early stop. Without the flag nothing changes. Unit and
  property tests.
- **REQ-S05 Setup.** On setup for civics and the full interview (when the gate is open), a checkbox:
  "I am 65 or older and have been a permanent resident for 20 years or more". The filing choice still
  picks the 2008 or 2025 set.
- **REQ-S06 Home card.** A card "65/20 civics practice" starts the civics part with the checkbox
  already ticked.
- **REQ-S07 Study first.** Study first can show only the designated questions of either version.
  As in all of Study first, questions whose answers change (dynamic) are left out; a legal line says
  how many of the 20 that is and where to check them (uscis.gov/citizenship/testupdates).
- **REQ-S08 Language.** Questions stay English. One line, a legal key (English until reviewed):
  "A 65/20 applicant may take the real civics test in their own language with an interpreter."
  linked to the Exceptions and Accommodations page. No question is translated.
- **REQ-S09 Audio.** Run `tools/audio/generate-audio.mjs --dry-run` and list missing clips.
  Result (2026-11-20): 65/20 adds no spoken text (its questions already have clips). The dry run lists
  18 clips, all for dynamic questions, which the app never plays; `--dry-run --skip-dynamic` lists 0.

## Step 2 — Open findings (`docs/audit/open-findings.md`)
- **REQ-F01 CON-04.** Each report stage summary also carries its lines as message keys with the
  numbers as placeholders (`StageSummary.summaryLines`, contract request CR-07). The report screen
  renders them through the locale files; in English the lines equal `summary`. Question texts stay
  English; legal lines stay English-only.
- **REQ-F02 CON-06.** Content loaders (practice content, pictures) accept `needsHumanReview: false`
  only with a named `reviewedBy` and an ISO `reviewedOn`, as the answer keys do. No flag is changed.
- **REQ-F03 CON-07, CON-12.** "Legal advice" and the listed wording points are corrected in the
  drafts where the audit names the problem; back-translations updated. All drafts still need a
  native reader (the AI label stays).
- **REQ-F04 CON-10.** The civics voice note says the closest of the device's guesses was used.
- **REQ-F05 CON-13.** Each picture question goes to the owner's checklist (Step 4).
- **REQ-F06 CON-14.** One line under the N-400 answer box: answer as the fictional person, no real
  details (a legal key).
- **REQ-F07 COR-04.** The plural limit moves to `practice-config.json`.
- **REQ-F08 SEC-07.** The speech-test server binds 127.0.0.1 unless `--host` is given; `fs.strict`.
- **REQ-F09 SEC-08.** Remove `worker/` if nothing uses it; update steering and README.
- **REQ-F10 A11Y-11, A11Y-12, A11Y-13.** Forced-colours borders for the stepper fill, the expanded
  header button and `.btn--active`; the icon contrast pairs recorded in the design system;
  `StatusBadge` line height from the tokens and `overflow-wrap: anywhere` on buttons.
- **REQ-F11 KIRO-01** closed (main merged and deployed, owner). DEP-02 stays open.

## Step 3 — Interaction tests (COR-01)
- **REQ-T01** Dev dependencies, exact versions checked on npm on 2026-11-20: `jsdom` 31.0.1,
  `@testing-library/react` 16.3.3 and its peer `@testing-library/dom` 10.4.2. The new tests opt in
  with `// @vitest-environment jsdom`; every existing test keeps the node environment.
- **REQ-T02** Click-through tests with the real engine and real data: home AI coach card → notice →
  Cancel → choice → No → first question; full interview → report with typed answers; reading near
  miss that still counts; writing "Show the sentence"; Study first paging; 65/20 setup; language
  menu; text size; no fetch before AI coach consent.

## Step 4 — Content waiting for the owner's review
- **REQ-R01** `tools/content-review/build-content-review.mjs` writes `docs/content-review.md`: one
  short checklist per data file still marked `needsHumanReview: true` (found by scanning `data/`),
  every item on one line with what to check, sized for about 30 minutes. It also lists the picture
  records named in CON-13. It changes no flag and says how to record a review (CON-06 rule).

## Step 5
Written into this file before it is built.
