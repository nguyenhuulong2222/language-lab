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

## D. Translations stay hidden (2026-11-17)

- **Decision (project owner):** `TranslatedQuestion` and `loadCivicsDisplay` are not wired into any screen. No language selector and no translated civics question is shown to users yet.
- **Why:** the translation files are display-only, marked `needsHumanReview`, and cover only part of the question set (see the coverage table above). In the 2025 set no non-English language has more than 38 of 128 questions imported, and hi, lo, hmn and my have none.
- **Enforced by:** `src/ui/__tests__/translations-stay-hidden.test.ts` fails if `src/ui/App.tsx` or any file in `src/ui/screens/` refers to either name or to the `civics-translations` module.
- **Reverse:** mount the component in a screen, and in the same change delete or edit that test and this entry.

## E. Booth screens: the practice flow (2026-11-17, branch ui/booth-screens)

Spec: `.kiro/specs/booth-screens/`. Each line: what, why, how to reverse.

- **Practice thresholds** (`data/practice/practice-config.json`): reading 0.8, writing 0.9 of the words must match. Chosen by me. They are not USCIS rules, and the screens say so. Writing is stricter because a typed word is either spelled right or not. Change the numbers in the file; no code reads a literal.
- **Closeness measure:** longest common run of words (in order, gaps allowed) divided by the word count of the longer sentence, so extra words and missing words both lower it. Case, punctuation and number words are ignored. Reverse: replace `compareSentence`.
- **One try per sentence.** The rules count sentences presented, so a retry would hide a miss. "Skip this one" counts as a wrong attempt, not an error.
- **Practice sentences** (12 reading, 14 writing) were written by me from the official vocabulary lists and are not USCIS test sentences. A test fails if a sentence uses a word outside its list. The vocabulary JSON was transcribed by hand from the PDFs (both "rev. 08/08", the revision the URLs serve today). A person should compare it with the PDFs.
- **No production lock on the practice content.** The sentence, profile and N-400 files carry `needsHumanReview: true` as asked, but nothing refuses them in production (only the answer keys do). Reverse: add a check like the answer key loader's.
- **Fictional profiles:** three invented profiles, with invented sample answers for the scripted N-400 questions. I replaced a "Have you filed your taxes every year?" question with "How do you usually prepare your income taxes?" because three identical "Yes" answers could read as the right answer.
- **Filing choice:** "before" gives the day before the boundary date, "on or after" gives the boundary date itself. These are fictional filing dates; `selectTestVersion` then picks the test. The screen never names 2008 or 2025 as a choice.
- **Civics selection:** the stage draws as many static questions as `questionsAsked` from the key, in a seeded random order, and stops where `runCivicsStage` stops. Dynamic questions are never offered (CR-003).
- **Official answers after each civics answer** come from the English display files in `data/translations/civics/<version>/en.json` (official USCIS text, not a translation), through `src/engine/official-answer-text.ts`. The list is labelled as waiting for review.
- **Production build:** the answer key loader is unchanged and refuses both keys while they say `needsHumanReview: true`. The intro, N-400, reading and writing work; civics shows a "switched off" message; no report is built. Checked on a real production bundle (see the kiro-log entry).
- **N-400 is not scored and is not in the report** (the report builder summarises reading, writing and civics only; the report page says so). No contract change was needed.
- **Voice:** the browser's speech recognition, language en-US. In some browsers (Chrome) the audio goes to the browser maker's service; the intro says so. Language Lab records and sends nothing.
- **Spoken prompts:** pre-generated OpenAI TTS clips in `public/audio/` (see the kiro-log entry on the AI voice), with the browser's voice as the fallback. The screen says "AI-generated voice" or "Device voice". The generator includes civics questions whose answers change (the app never asks them) unless run with `--skip-dynamic`; the clip manifest is bundled with the app so the voice is known at tap time.
- **Per-question feedback panels** carry the short disclaimer inline, in addition to the footer (content-safety rule 5 asks for it on every result surface).
- **UI tests are server-render tests.** The test environment has no DOM and no testing library, so clicks are not simulated; the reducer carries the behaviour and is tested through the real engine.
- **Dev server:** `vite.config.ts` allows `*.trycloudflare.com` so a phone can reach the dev server through a quick tunnel (the microphone needs HTTPS).
- **New design token** `--on-accent` (text on teal and amber buttons), in both themes.
- **Fonts:** the page still loads Bitter from Google Fonts (`index.html`, from before this work). That is the one network request the page makes by itself.

## F. Home, instructions, comfort settings, Vietnamese (2026-11-17, branch ui/booth-screens)

Spec: `.kiro/specs/booth-screens/`. What, why, how to reverse.

- **Single part = report for that part, no overall result.** The contract cannot express it (`FinalReport.practiceResult` is required, and `InterviewSession` needs a profile, a date and a version), so `src/engine/part-report.ts` has a local `PartReport` and the change is requested in `docs/contract-requests.md` as **CR-006** (pending, contract not edited). Reverse: move the type into the contract.
- **Part report badge says "This part went well" / "Worth reviewing"**, not "On track", after the content review said "On track" could read as a prediction. The scope line says the report shows how the part went in practice, not how you would do on the real test.
- **Setup asks only what the part needs:** profile for N-400 and the full interview, filing choice for civics and the full interview, nothing for reading and writing. The disclaimers moved to the home screen so every session sees them.
- **Home discards progress only after a confirm** (a panel in the header, not `window.confirm`).
- **"How this works" opens by itself once per screen per session, and sits after the question,** before the answer box, so the question is not pushed off the screen on a phone (ui-reviewer finding). "Seen" is kept in memory only.
- **Text size** scales the root font size (112.5% and 125%), so every rem size, including the 48px tap target (`--tap-min: 3rem`), grows with it. Slower playback is `playbackRate` 0.7 on the same MP3 (0.65 speech rate for the device voice). Settings are React state only.
- **Language button in the header** (the other language, in its own name) instead of a setting inside the Settings panel, so a Vietnamese reader can find it without reading English.
- **`vi.json` is an AI-written draft.** I wrote it; it is not a translator's work. `_meta.needsHumanReview` is true, with `reviewedBy` and `reviewedOn` empty. A test fails if the flag is cleared without a reviewer and a date. Reverse: delete `vi.json`.
- **Content-safety rule 3 is strict** (no AI translation of disclaimers, legal notices or instructional text; Vietnamese only from human-reviewed files in `data/translations/`). This draft is allowed only because the owner asked for it and it cannot reach a user in production: the switcher hides it (`availableUiLanguages`), the setter ignores it, and a Vite plugin (`tools/vite/strip-draft-locale.mjs`) replaces the file with its `_meta` in a production build, so the text is not in the bundle (checked: no Vietnamese string in `dist/`). The file sits in `src/i18n/locales/`, not `data/translations/`, as the owner specified; the steering text was not changed. Cloudflare preview deployments are production builds, so Vietnamese is review-in-dev only.
- **Only the interface is Vietnamese.** Civics questions, answers, reading and writing sentences, N-400 questions and sample answers stay English. The notice says the real interview is "held in English unless USCIS allows an exception for you" rather than an absolute (content review: uscis.gov names exceptions). The full report's stage summaries and review items are built in English by the engine and stay English; the report's English disclaimer gets the Vietnamese one beside it. Dates follow the language (`vi-VN`).
- **Terms:** "hồ sơ giả định" for fictional profile (not "bịa ra", which suggests deceit next to the truthfulness message); "phê duyệt hay bảo trợ" for "endorsed"; "tham khảo ý kiến" for "consult". All listed in the Terms table of `docs/vi-locale-review.md` for the reviewer.
- **Layout check is a developer tool** (`npm run layout-check`, headless Chrome at 390px, English and Vietnamese, normal and extra large text, 15 screens each). It is not part of `npm test`.
- **Start button uses `aria-disabled`** (focusable, hint readable) instead of `disabled`.
