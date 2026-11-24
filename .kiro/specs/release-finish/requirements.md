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

## Steps 2 to 5
Written into this file before each step is built.
