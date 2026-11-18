# Decisions log (autonomous round, 2026-11-17)

Each entry: what question came up, what was chosen, why, and how to reverse it.
Entries marked **LEAST SURE** are the ones most worth a second look.

Hard limits that held throughout: nothing pushed; `/Volumes/Crucial1TB/N400/` only read; `data/test-rules.json` untouched; both answer files keep `needsHumanReview: true`; no word added to an answer file that the USCIS source does not contain.

## A. Parenthesis markers

Markers live in `tools/answer-key/answer-markers.json`. A marker changes ONE parenthetical on ONE source line from "optional words" to "alternative name". Rebuild with `node --no-warnings tools/answer-key/build-answer-key.mjs --write=2008|2025|review`.

| Question | Source line | Chosen | Why | Reverse |
|---|---|---|---|---|
| 2025-067 | Serve (help, do important work for) the nation (if needed) | `help` and `do important work for` replace `Serve`. `(U.S.)` and `(if needed)` stay optional. | Owner's list. | Delete the marker. |
| 2025-077 | Boston Tea Party (Tea Act) | `Tea Act` replaces `Boston Tea Party`. | Owner's list. | Delete the marker. |
| 2025-077 | Intolerable (Coercive) Acts | `Coercive Acts` replaces `Intolerable Acts`. | Owner's list. | Delete the marker. |
| 2025-077 | British soldiers stayed in Americans’ houses (boarding, quartering) | Only `quartering` is added, and it replaces the whole phrase. `boarding` alone is not accepted. | Owner: add "quartering" only. Needed a new marker field `items`. | Delete the marker. |
| 2025-118 | Automobile (cars, internal combustion engine) | `cars` and `internal combustion engine` replace `Automobile`. | Owner's list. | Delete the marker. |
| 2025-118 | Integrated circuit (IC) | `IC` replaces `Integrated circuit`. Matched as a whole word only. | Owner's list. | Delete the marker. |
| 2008-061 | because of high taxes (taxation without representation) | `taxation without representation` replaces `high taxes`. | Owner's list. | Delete the marker. |
| 2008-061 | because the British army stayed in their houses (boarding, quartering) | Same as 2025-077: only `quartering`, replacing the whole phrase. | Owner's list. | Delete the marker. |
| 2025-101, 2025-106 | | Left as they were. | Owner's list. | n/a |

Side effect to know about: with an alternative marker the combined reading is no longer stored. For example "Intolerable Coercive Acts" (both words together) is not accepted, because only `intolerable acts` and `coercive acts` are. The same holds for "Boston Tea Party Tea Act". The previous optional reading did accept those.

## B. Matcher rules (`src/engine/answer-normaliser.ts`)

### B1. Alternative names are ONE answer
- **Chosen:** the data files have a new optional field `answerGroups` (list of lists of accepted answers). The matcher counts a group at most once. One group is emitted for every alternative marker, which covers all markers above and 2025-048. Pinned by tests, including "Secretary of War and Secretary of Defense" = 1 for 2025-048.
- **LEAST SURE (scope):** I only grouped lines that have an alternative marker. Other lines with several stored variants in "Name two/three" questions (slash alternatives, `(a, b)` optional lists) are not grouped, because grouping them could merge answers that are really different. Reverse or widen: add markers, or add a rule in `buildEntry`.
- Reverse: stop passing `groups` in `civics-grader.ts`.

### B2. Years and dates
- **Chosen:** when any accepted answer of a question contains a 4-digit year (1000 to 2099), the response's two-group readings are joined: `nineteen twenty` = 1920, `seventeen seventy-six` = 1776, `twenty oh one` = 2001, `nineteen oh five` = 1905. `two thousand one` already read as 2001. Other questions are unaffected, so "twenty twenty" is never a year where no answer is a year.
- Supported forms: two groups of 10 to 99 ("eighteen ten"), "oh" plus a digit ("twenty oh one"), "nineteen hundred" (already one number).
- **LEAST SURE (date rules, my addition):** an ordinal right after a month is read as the cardinal (`July fourth` = `July 4`), and `fourth of July` = `July 4`. This is needed for "July fourth, seventeen seventy-six" against `July 4, 1776`. It applies everywhere, not only in year questions. Reverse: delete `normaliseDates` in the matcher.
- Real-data tests: 2008-063, 2008-066, 2008-072, 2025-079, 2025-088, 2025-091, 2025-098, 2025-102, 2025-104, 2025-107.
- Known limit: for `July 4` alone (2008-099) the response "July 4, 1776" does not match, because the number continues. This is the existing "a number that continues does not match" rule.

### B3. Optional "because" / "because of"
- **Chosen:** a leading `because of` or `because` in an accepted answer is optional, composed with the optional article. A stored answer that is only the word `because` is kept.
- Reverse: remove the `bases` step in `alternativeForms`.

### B4. Bare numbers: per-answer marker `numberAlone`
Criterion: accept when the number alone answers the question ("What amendment", "How old", "When" with a year). Do not accept for "Why" questions, when the number is only part of an explanation, or when unsure.
Marked (the whole list):

| Question | Source line | Why accepted |
|---|---|---|
| 2025-097 | 14th Amendment | "What amendment..." |
| 2008-054 | eighteen (18) and older | "How old..." |
| 2008-057 | at age eighteen (18) | "When must men register": an age. **LEAST SURE:** the "between eighteen and twenty-six" lines have two numbers and are not marked. |
| 2025-104 | The Great Crash (1929) | "When did it start": a year |
| 2025-104 | Stock market crash of 1929 | same |

Considered and NOT marked: 2025-037, 2025-071, 2025-068, 2008-096/097, 2025-121/122 (Why, or part of an explanation); 2025-063 and 2008-048 ("Describe one of them"); 2025-098 and 2025-102 (`15th` / `19th amendment`: "When..." is not answered by an amendment number alone, **LEAST SURE**); 2008-063 and 2025-079 (a date needs month and day); 2008-072, 2025-088, 2025-091 (`War of 1812`); 2025-107, 2025-085 to 089, 2025-094 ("Name one..."); 2025-115, 2025-124, 2008-056 (`April 15`), 2008-099 (`July 4`), 2008-068.
Tests pin both the accepted and the rejected sets. For a marked answer with an ordinal ("14th") the plain numeral ("14") is also accepted.
Reverse: delete the entry in `numberAlone` in `answer-markers.json` and rebuild.

### Schema additions
`answerGroups?: string[][]` and `numberAlone?: string[]` on answer entries. The loader defaults both to `[]` and validates: members must be in `acceptedAnswers`, a member is in at most one group, a group has at least two members.

## C. Display layer for several languages

Scoring and the answer key stay English and unchanged.

### Policy decisions
- **Source:** the N400 repository, read only, commit `942c5d667397464205cddfc2cdce88adaabed8b3`, contentVersion `e54df6b`. Only the 14 listed languages are used (en vi es zh tl ko hi ht th lo hmn my pt ru). The six frame languages (ar ur gu fr bn uk) are not used.
- **LEAST SURE: machine-suggested text is NOT imported.** N400 marks LLM-generated text with `{lang}_suggested: true` and says it is unreviewed. content-safety rule 3 forbids machine translation of civics content, so these entries are only counted in the gap table. As a result hi, lo, hmn and my have no translated civics questions at all. Reverse: set `INCLUDE_MACHINE_SUGGESTED = true` in `tools/translations/import-n400.mjs` (not recommended).
- **LEAST SURE: 2025 translations that N400 inherited from a 2008 question with different English wording are not imported** (about 20 per language). Only the 2008 and 2025 questions with the same English wording count. Reason: a translation of a different sentence would be shown next to the wrong English. Reverse: relax the `sameWording` check in the script.
- Answers are paired only when the N400 English answers equal the USCIS answer lines one to one (and, for 2025, the inherited 2008 answers are also the same). Otherwise only the question is shown translated.
- English display text (`data/translations/civics/{2008,2025}/en.json`) is taken line by line from the USCIS source files.
- All translation files carry `needsHumanReview: true`, `status: "source"` on each entry, and provenance. "Reviewed" is nobody's claim yet.
- UI words (headings, buttons, feedback) are not translated: N400's `uiText` has different wording for a different product, and translating them myself would be machine translation. Non-English UI falls back to English. Only `en` locale text exists.
- Dates and numbers in the UI keep the `en-US` format for now.
- `tools/speech-test` (a developer tool with hard-coded Vietnamese test sentences) is not part of the product UI and is not moved to locale files.
- Each translated question is always shown with the English version and the line "translation for reference; the English version is official". A question with no translation in the chosen language shows English with the note "no translation yet". Nothing is translated to fill a gap.

### Coverage gaps per language
<!-- coverage:start -->
Generated by `tools/translations/import-n400.mjs` from N400 commit `942c5d667397464205cddfc2cdce88adaabed8b3` (contentVersion `e54df6b`). Machine-suggested text is not imported.

**2008 set (100 questions).** "Shown in language" counts questions with a translation. "With answers" counts those that also have the answer lines paired. The rest show English with the note "no translation yet".

| language | shown in language | with answers | machine-suggested (not imported) | inherited wording differs | unverifiable origin | not in source |
|---|---|---|---|---|---|---|
| vi | 100 of 100 | 87 | 0 | 0 | 0 | 0 |
| es | 100 of 100 | 87 | 0 | 0 | 0 | 0 |
| zh | 100 of 100 | 87 | 0 | 0 | 0 | 0 |
| tl | 100 of 100 | 87 | 0 | 0 | 0 | 0 |
| ko | 100 of 100 | 86 | 0 | 0 | 0 | 0 |
| hi | 0 of 100 | 0 | 99 | 0 | 0 | 1 |
| ht | 100 of 100 | 87 | 0 | 0 | 0 | 0 |
| th | 100 of 100 | 77 | 0 | 0 | 0 | 0 |
| lo | 0 of 100 | 0 | 99 | 0 | 0 | 1 |
| hmn | 0 of 100 | 0 | 99 | 0 | 0 | 1 |
| my | 0 of 100 | 0 | 99 | 0 | 0 | 1 |
| pt | 100 of 100 | 81 | 0 | 0 | 0 | 0 |
| ru | 100 of 100 | 78 | 0 | 0 | 0 | 0 |

**2025 set (128 questions).** "Shown in language" counts questions with a translation. "With answers" counts those that also have the answer lines paired. The rest show English with the note "no translation yet".

| language | shown in language | with answers | machine-suggested (not imported) | inherited wording differs | unverifiable origin | not in source |
|---|---|---|---|---|---|---|
| vi | 38 of 128 | 5 | 67 | 20 | 3 | 0 |
| es | 36 of 128 | 4 | 67 | 20 | 5 | 0 |
| zh | 37 of 128 | 5 | 68 | 19 | 4 | 0 |
| tl | 37 of 128 | 5 | 68 | 19 | 4 | 0 |
| ko | 37 of 128 | 5 | 68 | 19 | 4 | 0 |
| hi | 0 of 128 | 0 | 126 | 0 | 0 | 2 |
| ht | 38 of 128 | 5 | 67 | 22 | 0 | 1 |
| th | 38 of 128 | 4 | 67 | 22 | 0 | 1 |
| lo | 0 of 128 | 0 | 126 | 0 | 0 | 2 |
| hmn | 0 of 128 | 0 | 126 | 0 | 0 | 2 |
| my | 0 of 128 | 0 | 126 | 0 | 0 | 2 |
| pt | 38 of 128 | 4 | 67 | 22 | 0 | 1 |
| ru | 38 of 128 | 4 | 67 | 22 | 0 | 1 |

<!-- coverage:end -->
