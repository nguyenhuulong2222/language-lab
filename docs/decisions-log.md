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
- UI words (headings, buttons, feedback) were not translated at that time: N400's `uiText` has different wording for a different product. **Superseded by section G below** (AI-translated interface languages, with safeguards).
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

- **(Superseded by section I: no thresholds any more; scoring follows the USCIS guidelines.)** Practice thresholds (`data/practice/practice-config.json`): reading 0.8, writing 0.9 of the words must match. Chosen by me. They are not USCIS rules, and the screens say so. Writing is stricter because a typed word is either spelled right or not. Change the numbers in the file; no code reads a literal.
- **(Superseded by section I.)** Closeness measure: longest common run of words (in order, gaps allowed) divided by the word count of the longer sentence, so extra words and missing words both lower it. Case, punctuation and number words are ignored. Reverse: replace `compareSentence`.
- **(Superseded by section I: "Try again" replaces the last attempt.)** One try per sentence. The rules count sentences presented, so a retry would hide a miss. "Skip this one" counts as a wrong attempt, not an error.
- **Practice sentences** (12 reading, 14 writing) were written by me from the official vocabulary lists and are not USCIS test sentences. A test fails if a sentence uses a word outside its list. The vocabulary JSON was transcribed by hand from the PDFs (both "rev. 08/08", the revision the URLs serve today). A person should compare it with the PDFs.
- **No production lock on the practice content.** The sentence, profile and N-400 files carry `needsHumanReview: true` as asked, but nothing refuses them in production (only the answer keys do). Reverse: add a check like the answer key loader's.
- **Fictional profiles:** three invented profiles, with invented sample answers for the scripted N-400 questions. I replaced a "Have you filed your taxes every year?" question with "How do you usually prepare your income taxes?" because three identical "Yes" answers could read as the right answer.
- **Filing choice:** "before" gives the day before the boundary date, "on or after" gives the boundary date itself. These are fictional filing dates; `selectTestVersion` then picks the test. The screen never names 2008 or 2025 as a choice.
- **Civics selection:** the stage draws as many static questions as `questionsAsked` from the key, in a seeded random order, and stops where `runCivicsStage` stops. Dynamic questions are never offered (CR-003).
- **Official answers after each civics answer** come from the English display files in `data/translations/civics/<version>/en.json` (official USCIS text, not a translation), through `src/engine/official-answer-text.ts`. The list is labelled as waiting for review.
- **Production build:** the answer key loader is unchanged and refuses both keys while they say `needsHumanReview: true`. The intro, N-400, reading and writing work; civics shows a "switched off" message; no report is built. Checked on a real production bundle (see the kiro-log entry).
- **N-400 is not scored and is not in the report** (the report builder summarises reading, writing and civics only; the report page says so). No contract change was needed.
- **Voice:** the browser's speech recognition, language en-US. In some browsers (Chrome) the audio goes to the browser maker's service; the intro says so. (Superseded by section I: the recognition path records nothing; "Record and compare" keeps a recording in memory on the device and never sends it.)
- **Spoken prompts:** pre-generated OpenAI TTS clips in `public/audio/` (see the kiro-log entry on the AI voice), with the browser's voice as the fallback. The screen says "AI-generated voice" or "Device voice". The generator includes civics questions whose answers change (the app never asks them) unless run with `--skip-dynamic`; the clip manifest is bundled with the app so the voice is known at tap time.
- **Per-question feedback panels** carry the short disclaimer inline, in addition to the footer (content-safety rule 5 asks for it on every result surface).
- **UI tests are server-render tests.** The test environment has no DOM and no testing library, so clicks are not simulated; the reducer carries the behaviour and is tested through the real engine.
- **Dev server:** `vite.config.ts` allows `*.trycloudflare.com` so a phone can reach the dev server through a quick tunnel (the microphone needs HTTPS).
- **New design token** `--on-accent` (text on teal and amber buttons), in both themes.
- **Fonts:** the page still loads Bitter from Google Fonts (`index.html`, from before this work). That is the one network request the page makes by itself.

## F. Home, instructions, comfort settings, Vietnamese (2026-11-17, branch ui/booth-screens)

> **Partly superseded by section G.** The Vietnamese-only parts of this section (draft hidden in production, the build plugin, the `needsHumanReview` flag, "no AI translation of disclaimers", the single language button, `docs/vi-locale-review.md`) no longer apply. Now: 14 AI-translated languages with a label, English next to the disclaimer, a language menu, and `docs/locale-review.md`.

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
- **Terms:** "hồ sơ giả định" for fictional profile (not "bịa ra", which suggests deceit next to the truthfulness message); "phê duyệt hay bảo trợ" for "endorsed"; "tham khảo ý kiến" for "consult". All listed for the reviewer in `docs/locale-review/vi.md` (the Vietnamese-only sheet `docs/vi-locale-review.md` was replaced by per-language sheets in section G/H).
- **Layout check is a developer tool** (`npm run layout-check`, headless Chrome at 390px, English and Vietnamese, normal and extra large text, 15 screens each). It is not part of `npm test`.
- **Start button uses `aria-disabled`** (focusable, hint readable) instead of `disabled`.

## G. Policy change: AI-translated interface languages (2026-11-17, owner decision)

**What.** `content-safety.md` rule 3 changed. Before: any non-English text only from human-reviewed
files in `data/translations/`, and no AI translation of civics questions, legal notices, disclaimers
or instructional content. Now:

- The **interface** (`src/i18n/locales/`) may ship in AI-translated languages when (a) the screen
  shows a clear label that the translation is AI-generated, may contain errors, and that English
  is the authoritative version; (b) the disclaimer is always shown together with its English text
  in every non-English language; and (c) the automated checks pass (same keys and placeholders,
  numbers kept, fixed names kept, no empty strings, no untranslated leftovers).
- A language **loses the label** only when a named human reviewer and a review date are recorded
  in its `_meta` (`reviewedBy`, `reviewedOn`).
- **Unchanged and still English only:** civics questions, accepted answers, reading and writing
  sentences, N-400 questions and sample answers. Translations of civics questions stay hidden
  (`translations-stay-hidden` still passes).

**Why.** The owner wants applicants to use the tool in their own language now, with honest
labelling, instead of waiting for human translators. The label and the English disclaimer keep
the English text as the reference, and the checks catch mechanical damage (a lost placeholder, a
changed number, a dropped name). They cannot catch a wrong meaning: that is what the review sheets
and the reviewer are for.

**Risk the owner accepted.** An AI translation can be fluent and wrong, and the checks cannot see
that. A reader who trusts a wrong disclaimer line is the harm to watch. The English text next to
every disclaimer, the label on every screen, and the back-translation pass of the legal lines
(`docs/locale-review.md`) are the mitigations.

**How to reverse.** Revert this section and the `content-safety.md` change, and make
`availableUiLanguages()` return English only.

**What this replaced.** The previous gate (a draft locale hidden in production while
`needsHumanReview` is true, with a build plugin that removed its text from the bundle) is removed.
## H. Language menu, review sheets, pictures (2026-11-18, branch ui/booth-screens)
**Interface languages (steps 3 to 6 of the AI-translation work).**
- **Menu, not radios.** The header language control is a button that opens a list of buttons, one per language by its own name, English first, with `aria-current` and a check icon on the current one. Radios were rejected because arrow keys on radios change the selection, which would switch the language as the user moves.
- **Chinese is Traditional** (`zh-Hant`, 中文（繁體）) because USCIS's Chinese materials and the N-400 data are Traditional. Simplified is not offered. Filipino uses `fil`.
- **Fonts.** System font stacks per script in `src/ui/styles/scripts.css`, no web fonts. Checked on macOS Chrome (headless, screenshots) only. Not checked: iPhone, Android, Windows. A Burmese phone that still uses Zawgyi text may show garbled letters.
- **Dates.** Gregorian calendar and Latin digits in every language; English month names where the browser has no data (Hmong, Haitian Creole).
- **Home heading.** All languages use "Welcome to Language Lab" (the English still says "Welcome to the booth"). I applied the Vietnamese decision to the others and suggest changing English too.
- **Bundle.** All 14 locales are imported eagerly (about 183 kB gzip for the whole app). Lazy loading was not done.
- **Back-translation.** I back-translated the 16 legal and disclaimer keys in 13 languages. This is a weak check (the same AI wrote and read them). It found six real problems (Russian "unless" reversed, "passed the test" wording in Russian, "succeeded" in Filipino, "has power" for "authoritative" in Lao, Hmong and Burmese); all fixed. The content reviewer later asked for "official" in six more; done.
- **Review fixes.** English text inside another language uses a Latin font; no empty English line in English; arrow-key edge case; list border contrast; heading replaced by a label; `aiNotice.text` says "official" in every language.
- **Not done on reviewer advice (owner decision):** an English line next to `voice.privacy` and other privacy lines (rule 3(b) names only the disclaimer); a live-region announcement after a language change.
- **Layout check** runs per language (`--lang=th`); a single run over all 28 configurations hung once, cause unknown. Each language alone passes at normal and extra-large text.
**Pictures for civics questions (BS-20, BS-21).**
- **Sources.** Smithsonian Open Access (api.si.edu, DEMO_KEY, 10 requests an hour) gave the 11 pictures that shipped: National Portrait Gallery items whose media `usage.access` and `objectRights` ("Restrictions & Rights") both say CC0. loc.gov is the second source, only items whose own record says "No known restrictions on publication" (or public domain, U.S. government work, CC0). `acceptableRights()` refuses "Rights status not evaluated", "Publication may be restricted", a named rights holder, a credit-line requirement. Items with no rights text in the record are skipped. Wikimedia Commons and other non-federal sites are not used.
- **Smithsonian rights statement.** The si.edu object pages answer scripted requests with HTTP 403, so I could not read the page. The rights statement is the record's own `objectRights` field from the Open Access API (the same record the page shows), snapshotted in `data/images/si-records.json` and copied as is ("Restrictions & Rights: CC0"). Whether that satisfies "its own page" is the owner's call; opening the 11 object pages once in a browser would close the gap.
- **Rate limit.** loc.gov blocked me (HTTP 429) after parallel searches (my mistake: three at once). The tools now stop at the first 429. Pictures I wanted and could not fetch are in `docs/image-todo.md`, with no other source substituted.
- **Pairings I removed after review:** Stanton for "Name one women's rights leader" (one portrait for a many-answer question), the Mayflower compact for "why colonists came", the 1914 flag (48 stars) for the 50-stars questions.
- **Flagged for the owner:** the Eisenhower photograph (carbro print 1945, donated by the photographer's widow; the record says CC0) and the Declaration engraving (its border has state seals, historical, not an agency insignia).
- **Study first** shows the picture and its caption above the question. For "Who was the first President?" the caption names the answer. That is intended: nothing is scored there.
- **Pictures appear only after grading and in Study first.** The feedback panel shows the picture after the official answers. The question view has no picture; tests render it with a picture available for every question, and a source test fails if any other component renders `QuestionPicture` or an `<img>`.
- **Study first** is a separate view (no engine mode, no session, nothing recorded). It follows the answer-key lock: when the key is locked (production build, `needsHumanReview`) Study first shows a notice instead of answers, so the lock cannot be bypassed. Questions whose answers change are left out, as in practice.
- **Pairings** are in `data/images/picks.json` (my choices) and generated into `question-images.json` (`needsHumanReview`). A picture that shows a building or a document is paired with the question about it; I did not pair a picture where it could suggest the answer to a "who/what" question wrongly. The owner should check `docs/image-review.md`.
- **Captions** are the source's own title, verbatim. Alt text is mine and describes what the title says.
- **Credits** screen is opened from a footer button; the practice stays mounted (hidden) so no answers are lost.
**How to reverse.** Delete `data/images/*`, `public/images/`, the picture components and the home option. Nothing in the engine or contracts changed.
## I. Fair scoring, alternatives, listen and compare, honest feedback (2026-11-18, branch ui/booth-screens)
Spec: BS-22 to BS-25. Source: USCIS Policy Manual, Vol. 12, Part E, Ch. 2 (saved in `data/sources/`, URL and SHA-256 in its README).
**The scoring rule (reading and writing alike).** An attempt counts when every content word of the sentence is present, in order. It replaces the old "at least 80% / 90% of the words" threshold, which failed "Who elect the president" against "Who elects the President?" (3 of 4 words = 75%) on an iPhone.
- **What the guidelines say** (quoted in BS-22): read all content words; short words may be omitted; omitting or substituting a content word fails; pronunciation errors that do not interfere with meaning are fine; writing may have spelling, capitalization and omitted-short-word errors, but not "a different sentence or words".
- **What is my choice, not in the guidelines** (the config, `data/practice/practice-config.json`, and the feedback line say "Language Lab practice setting"):
  - "Short words" = the "Other (Function)" words of the two official vocabulary lists (a, and, during, for, here, in, of, on, the, to, we). The manual does not define short words, and omitting "we" or "during" could change meaning in a real interview. A short word may be missing **or added**.
  - Order. The manual does not mention it; reading the words out of order is not reading the sentence.
  - A plural or possessive ending (-s, -es, 's) is the same word. `sameInflection` compares two words directly (one is the other plus s, es, ies), never shortens a word, and a test snapshots every pair in the vocabularies that it equates. do/does are not equated (too short).
  - One extra content word is allowed (the guidelines do not list an inserted word, and a recogniser adds stray words); two are not.
  - Writing only: a one-letter spelling error in a word of 5+ letters with the same first letter counts as that word, unless the typed word is itself a different word of the official vocabulary ("Check the spelling" is shown).
- **Not scored** (cannot be judged from text): pauses, pronunciation, whether an officer would understand. The screen says so.
**Alternatives.** The recogniser is asked for 5; every one is scored; the best is "What we heard". Typed or edited text is scored as typed. For civics the alternatives are compared with the answer key by the same matcher that scores the answer (`matchedAnswerCount`); no AI scores civics. A side effect to know: up to 25 guesses can make a voice answer slightly easier than one hearing by an officer. The note says the result rests on the words the device heard.
**What each browser returns:** not measured on devices. WebKit's source passes up to `maxAlternatives` transcriptions from Apple's recogniser on iPhone; Chrome returns up to `maxAlternatives` on desktop and Android. See design.md; **needs a device test**.
**Listen and compare.** Two controls, never together: "Say it" (check) and "Record and compare" (self-review), because sharing the microphone on iPhone Safari is unverified. Starting one stops the other. The recording is a Blob in memory behind an object URL, for the current sentence only, discarded on the next sentence, on leaving, and on "Try again"; the recorder module mentions no network or storage API (a test enforces it). The sample is the pre-generated AI voice (group `reading`, 12 clips, 0.5 MB) and appears only after a first attempt. Stop during the microphone prompt cancels the start. "Try again" replaces the last attempt of that sentence (a pass can be replaced by a miss; there is no stake in practice).
**Honest feedback.** Plain lines instead of crossed-out words ("You said “elect”. The sentence says “elects”. This still counts."); a line under every result about what the result rests on; hidden for a skipped answer. English words inside translated lines are marked `lang="en"`.
**Not done / left to the owner:** `reading.done.passed` still says "You read a sentence correctly" (the tool cannot judge pauses or pronunciation); the Hmong, Korean and Burmese lines the reviewer doubted are listed in `docs/locale-review.md`; a real-device test (see the report).
**How to reverse.** Revert the commits "Step 1" to "Step 5"; the reducer keeps its old shape apart from the new optional fields.

## J. Audit fix pass (2026-11, branch ui/booth-screens)

- **Step 1 (DEP-01):** all non-English civics translation files and the N-400 importer removed. `en.json` display files are rebuilt from `data/sources` only (`tools/translations/build-english-display.mjs`). `NOTICE` and the README "Licence scope" section say MIT covers this repository only and grants nothing in formN400.org.
- **Step 2 (CON-02, CON-07):** legal text is English only in every locale without a named reviewer (`src/i18n/legal-keys.ts`; the locale files keep the AI drafts for the reviewer, not shown). One short translated line (`aiNotice.legalEnglish`) says why. Hmong wording fixed (not native-reviewed). Back-translation check covers 6 more keys; the report keys follow in Step 6. hmn, lo, my and ht are hidden in the production menu (`IN_REVIEW_LANGUAGES`), available in dev; the menu says more languages are in review.
- **Step 3 (SEC-01, SEC-02, PERF-02):** Bitter self-hosted (variable woff2, latin, latin-ext, vietnamese, cyrillic; cyrillic-ext left out, falls back to the slab stack), OFL text in `public/fonts/`, credit on the Credits screen. Google Fonts removed. `public/_headers` carries the strict CSP, nosniff, no-referrer, Permissions-Policy (microphone self only) and cache rules. `Cache-Control: no-cache` is set only on `/` and `/index.html` because Cloudflare joins values from several matching rules. Verified: `docs/audit/step3-csp-verification.md`.
- **Step 4 (SEC-03 to SEC-06):**
  - The secret-path hook is now `.kiro/hooks/scripts/block_sensitive_paths.py`. It splits every string of the tool call into words and path segments, so the dot-env file name, its suffixed variants (not the example file), the Cloudflare dev-vars file and the private folder are caught as real segments, and `environment.ts` is not. It strips quotes and backslashes and blocks globs that start with a literal dot. It is a guard against accidents, not a boundary: it cannot see variables, encoded names or names built by a script.
  - Proof: `npm run test:hooks` (21 cases, output in `docs/audit/step4-hook-test.txt`). The hook also blocked two of my own tool calls during this step because the calls named those files in text, which shows it is active in this IDE session. A full end-to-end check by asking an agent to read the key file is still the owner's to run.
  - The two save hooks now run `npm test` and `npm run typecheck` without the absolute path.
  - Credits open or the tab in the background make the practice "hidden" (`PracticeHiddenContext`): `AnswerInput` stops the recogniser, `useSelfReview` calls the new controller `suspend()` (drops the recording, closes the microphone), and `Shell` cancels the audio. The practice stays mounted so typed text is kept.
  - A one-time notice before the first "Say it" in a session (`voice.consent.*`, kept in the same in-memory set as the help panels). The text is a legal key (English only unless reviewed). Buttons: "Continue and say it" and "Type instead".
- **Step 5 (A11Y-01 to A11Y-08):**
  - Writing: a "Show the sentence" button under the hidden sentence, with a line saying the report marks the attempt as assisted. When the audio fails (the clip and the device voice both fail, or there is no voice at all), the failure is announced in a live region and the sentence is shown. The attempt is scored the same way (same rule, same threshold); `SentenceAttempt.assisted` records it, the feedback and the part report say "assisted attempt", and the full report's writing summary counts them. This is an engine-local type, not a contract change. My decision: an assisted attempt still counts toward the result, because it is a practice tool and the owner asked for a route, not a penalty. The report states it so the learner sees the difference.
  - Header: "Yes, go home" closes the panel; opening Settings, About or Home moves focus into the panel; tabbing out of the header closes it; the language menu is one tab stop with arrow keys (roving tabindex).
  - Errors: the N-400 load failure is `role="alert"`; the empty-answer message is an alert and the answer box gets `aria-invalid`; pressing the disabled Start button announces the hint again.
  - Study first: the picture comes after the question and the count is no longer a live region.
  - `lang="en"` on the engine's report disclaimer and summaries, the N-400 answer list, the profile names and the answer box.
  - Mono "tape counter" lines use the script's body font in th, lo, my, hi, zh and ko.
  - Layout check: `--width=320` and `--prod` (production build, `_headers` applied, CSP violations fail the run). Proved the detector works by setting `font-src 'none'` for one run: 64 violations reported; the real policy gives none. Results: prod 320 px, normal and extra-large, en + 9 production languages: all pass; dev 320 px en: all pass.
  - Not unit-tested: focus moves and keyboard handling (no DOM in the test environment); covered only by the Chrome run.
- **Step 6 (CON-04, CON-05, CON-08):**
  - Report wording: "You're on track" became "Practice complete: each part reached the practice score"; the lead says each part "reached the score Language Lab uses"; badges say "Practice score reached" and "This part reached the practice score". The engine summaries say "practice passing score". A test checks that these lines name the practice and contain no "on track", "likely" or "ready for". The summaries are still English in translated reports (they are a contract string); that part of CON-04 stays open.
  - Back-translations now cover `report.title.*`, `report.lead.*` and `compare.setting.writing` (all 13 languages), which closes the CON-07 key list.
  - README: the civics line says the answer key is Language Lab's own build, not yet reviewed, and switched off in production; the picture line names the Library of Congress pictures; Node 22.18+ for the tools; the live URL https://language-lab-ade.pages.dev (it answers HTTP 200; it still serves the older build with Google Fonts until this branch is deployed).
  - Spelling (writing): the one-letter-from-5-letters rule is replaced by limits by word length in `practice-config.json` (`sentenceMatch.spellingSlips`: 1 letter from 4 letters, 2 from 8 letters; first letter right; the typed word is not another vocabulary word; 3-letter words exact). "citzns can vot" now counts. My choice of numbers: they approximate "the meaning is still clear", which text cannot judge. This also moves the spelling limits out of code (COR-04, partly: the plural rule's 3-letter limit stays in code).
  - On screen: a new legal line `compare.setting.writing` on the writing screen and its feedback quotes the USCIS rule (spelling, capitals and punctuation do not fail unless the sentence cannot be understood) and says small slips count. English only until reviewed.
- **Step 7 (CON-01, CON-03):** while civics is locked (the production build), the home screen opens its choices with a panel "In this build you can practice" and the reworded `intro.locked` ("Civics, Study first and the full practice interview are switched off in this build until a person has reviewed the civics answer key. You can practice the N-400 interview, reading and writing."). The Full interview card, the Study first card and the Civics card are not shown; only N-400, Reading and Writing remain. My decision: hide rather than disable, because a disabled card is still a headline and still a dead end for a screen-reader user. `intro.locked` stays a legal key (English only until reviewed); the new heading `home.locked.title` is translated. The answer keys were not reviewed and no `needsHumanReview` flag was changed, so CON-01 itself (the keys need a person) stays open; the dead end is gone.
- **Step 8 (PERF-01, COR-02):**
  - Locales: English is in the main bundle; every other locale is a lazy chunk fetched when it is chosen (`loadLocale`), checked again against English on arrival, and the interface switches only after it passed. The menu and the AI label read `src/i18n/locale-status.json` (each locale's `_meta` and its check result), written by `tools/i18n/build-locale-status.mjs`; a test fails when it is out of date. Tests load every locale in `src/test-setup.ts` (vitest `setupFiles`).
  - Answer keys and the official answer text: fetched when a civics part starts (on Start in setup, for the version the filing choice leads to) and when a version is chosen in Study first (`env.prepareCivics`). A key this build refuses is not downloaded. The production lock is known without the files through `ANSWER_KEY_NEEDS_REVIEW`, a copy of the two flags that a test keeps equal to the data files; the loader's own production check is unchanged (a test proves it still throws). "Not loaded yet" is not cached as a lock.
  - Result: main JS 841 kB (208 kB gzip) became 377 kB (112 kB gzip). Each locale is 15 to 46 kB, each key 47 or 71 kB.
  - Known gap: if the key download fails (network), the civics part shows the locked message, which names review as the reason. Rare; listed in open findings.
  - CI: `.github/workflows/ci.yml` runs `npm ci`, typecheck, tests, build and the hook test on every push and pull request, on Node 22.18, with read-only permissions. Not run on GitHub yet (nothing pushed).
- **Step 9:** the fictional profile "Aurora Vance" is now "Aurora Thistlewood" (`fictional-profile-aurora-thistlewood`) in the profiles, the N-400 sample answers, `mock/session.json`, the report test, `format.ts` and CR text. My choice of surname: an English place-style name that, to my knowledge, no current or recent member of Congress, cabinet member, governor or national candidate carries; I checked from memory, not against a database. The 7 old sample clips and their manifest entries were deleted (their ids carried the old name); `docs/audio-regenerate.md` lists the 7 clips to make, with the command. The generator was not run. Until then those samples use the device voice.
- **Step 10:**
  - Quick low fixes: favicon as an inline SVG of the reel glyph (SEC-09); Credits links named "Source page: {title}", Escape closes Credits, focus returns to the button that opened it (A11Y-09); a heading focused from code shows the ring when the user is on the keyboard (A11Y-10); the report no longer shows the same English disclaimer twice (CON-11); value assertions instead of `toBeDefined`/`toBeTruthy` in the rules tests and the always-true count (COR-03); README "How Kiro was used" (KIRO-02); `license` and `engines` in `package.json`. PERF-03 is closed by the cache rules of Step 3 (they apply after a deploy).
  - Reviewers. `ui-reviewer` found a real bug: "Type instead" counted as having seen the voice notice, so a later "Say it" skipped it. Fixed (a source test guards it). Also fixed: focus after "Continue and say it" and after "Show the sentence", a failure line that fits every screen ("Try again, or read the text on the screen"), an icon on it, named regions for the header panels, font cache one week instead of a year (the files are not hashed), a preload for the Latin font file. `content-reviewer` found legal statements still translated: `study.locked`, `compare.vocab`, `civics.stopped.correct` and `civics.stopped.incorrect` are now legal keys, shown in English until reviewed. README: Node line, the list of USCIS sources, `.txt` files are extracts. `fromTheGuidelines` now names punctuation. The rest is in `docs/audit/open-findings.md` with reasons.
  - Decisions left to the owner: whether an assisted writing attempt should count toward the practice result (it does now); whether `home.lead`, `setup.lead` and `study.lead` should be legal keys (they are not).

## K. Answer key review (2026-11-20, branch ui/booth-screens)

- **Owner decisions** (recorded in `tools/answer-key/answer-markers.json`, dated 2026-11-20; no answer outside the USCIS text):
  - 2025-107: "(during)" is an alternative for "at the end of": `president at the end of the korean war` and `president during the korean war`, one answer; `president at the end of during the korean war` removed.
  - 2025-126: `washington's birthday`, one answer with `presidents day`.
  - 2025-028: `connecticut compromise`, one answer with `the great compromise`; `the great compromise connecticut compromise` removed.
  - 2008-045, 2008-017, 2025-019, 2025-016 (both lines): items in any order (`anyOrder` in the data); all items of one line required; the two lines of 2025-016 never mixed.
  - 2008-100 and 2025-126: "Jr." optional (`martin luther king day`, one answer with `martin luther king jr day`).
  - 2025-126: "Day" optional in Thanksgiving Day and Christmas Day. Because the question needs three answers, the build's existing rule keeps only the shorter form (`thanksgiving`, `christmas`), which still matches "Thanksgiving Day". `thanksgiving day` and `christmas day` are no longer stored as separate strings.
- **Build script:** two new marker kinds (`optionalWords`, `anyOrder`), validated against the source line; the matcher counts placements made of several spans for any-order lines.
- **Sentence answers:** the 23 SENTENCE questions carry `matchAs: "sentence"`. Every content word in order, other words may come between; function words are the reading rule's list in `practice-config.json`; endings by `sameInflection`. My choice: unlike the reading rule, any number of extra words may come between (a civics answer is often wrapped in "I think ..."); a missing or substituted content word still fails. A leading "because" stays optional, as before.
- **Review record:** `tools/answer-key/review.json` holds the reviewer, date, note and the SHA-256 of the reviewed entries; the build writes `needsHumanReview: false` only while the entries match. My choice, so that a later rebuild cannot keep a stale approval. The loader refuses in production a file marked reviewed without `reviewedBy` and `reviewedOn`.
- **Independent check:** `tools/answer-key/check-against-source.py` (from the audit's `keycheck2.py`, extended to every combination of optional parentheses, slash alternatives, "Also acceptable" notes, any-order items, and a list of answers that come from owner decisions). 0 mismatches for both versions.
- **Production:** civics, Study first and the full interview are on; `layout-check --prod` now also asserts every home card, a loaded Study picture and the test version on the report, and takes `--filed=before` for the 2008 test.

## L. Optional AI coach for the N-400 part (2026-11-20, branch engine/interview-coach)

Spec: `.kiro/specs/interview-coach/` (requirements revision 2 with two Analyze Requirements rounds).

- **Server:** Cloudflare Pages Function `functions/api/coach.ts`, same origin, so the CSP keeps
  `connect-src 'self'`. Thin; every check is in `src/engine/coach/` and tested there. The Function
  sets its own security headers (`_headers` does not reach Functions).
- **Counters:** D1 (`COACH_DB`), because the Workers rate-limiting binding is not available to Pages
  Functions and KV is eventually consistent. One atomic `INSERT ... ON CONFLICT DO UPDATE ... WHERE
  count < limit RETURNING` per counter; spend is reserved before a call and settled after.
- **Model:** `claude-haiku-5-5` (cheapest current model; $0.10 / $0.50 per MTok), effort `low`,
  thinking off, `max_tokens` 300, strict JSON schema output, API version `2026-10-21`.
  `temperature` stays in the config as `null` because that API version rejects it (owner's brief
  asked for it; recorded as A1).
- **My decisions:**
  - The client sends ids (profile, question), not texts; the server looks them up. The learner's
    answer is the only free text that reaches the model.
  - The follow-up question is shown for practice only; it is not answered, recorded or sent.
  - The feedback step sits between the answer and the next question only while the coach is on.
  - The AI result type is engine-local (`src/engine/coach/types.ts`); no contract change.
  - No probe before consent: a learner may see the notice once and then "not available" if the
    coach is switched off; the switch then turns itself off.
  - Limits: answer 600 characters, body 4,096 bytes, 12 turns per session, 30 per IP per hour and
    80 per day, 600 calls and $0.50 per UTC day, 8 s upstream and 12 s client timeouts.
  - IP counters use SHA-256 of IP, UTC day and a required secret salt; no salt means unavailable.
  - The deny-lists (`data/coach-deny-list.json`) are mine, best effort. After the content review I
    added more claim, outcome, correctness and government-voice phrases, removed "apply for" and
    "file for" (they blocked normal follow-ups), made the title-and-name check case-insensitive with
    apostrophes, and applied the identifier-request words to the tip too. Known false positives:
    follow-ups that mention "government", "official", "address" or "email" are dropped.
  - Feedback labels: "Easy to understand", "Worth practicing again", "Hard to follow. Try again.",
    with the line "This checks how clear your English is. It does not say whether an answer is right
    or true." The follow-up is "A practice follow-up question:" (not "An officer might also ask").
  - The rule-5 disclaimer (`disclaimer.report`, English) shows in the feedback step; the three short
    disclaimers show in English under the switch while the coach is on.
  - "AI-generated feedback" stays on every AI line (the owner's rule), although the content reviewer
    suggested one label per block to reduce screen-reader repetition.
  - Translations: AI drafts in 13 languages; the legal keys (`coach.notice.text`, `coach.privacy`,
    `coach.screened`, `coach.followUp.note`, `coach.switch.help`, `coach.feedback.scope`) are shown in
    English until a reviewer is recorded. The back-translations of `coach.notice.text` and
    `coach.privacy` after the review rewrite are one English rendering checked against each draft by
    me: a weak check, like the rest of that file.
  - No Privacy screen exists; the privacy line `coach.privacy` is on the home screen, the setup
    screen and the About panel.
- **Reviews:** `ui-reviewer` found that the result was probably not announced (live region mounted
  with its content, and focus moved away at once); fixed with one status region mounted from the
  "checking" line and focus on it. Also fixed: focus while checking, a stuck "checking" if the call
  rejected, the disabled switch (now `aria-disabled`, still focusable), Escape on the notice,
  forced-colours thumb, "Next question" after the last question (now "Continue"). `content-reviewer`
  found the notice's "your voice is never sent" too absolute (browser speech recognition), no
  retention statement, the sample answer used without a rule, thin deny-lists, and the missing
  rule-5 sentence; all fixed. The prompt now forbids comparing facts with the sample answer,
  correctness verdicts and speaking for USCIS.
- **Open (owner):** Anthropic data retention terms; a dedicated Privacy screen if wanted; the
  notice is dense for ESL learners and English only until reviewed; `product.md` and the coach notice wording (resolved in M); the officeholder list needs updating when officeholders change;
  names, street addresses, receipt and passport numbers are not screened; the per-session turn cap
  is advisory on the server.

## M. Discoverable AI coach (2026-11-20, branch ui/coach-discoverable)
- **Problem:** the coach switch inside the N-400 screen was not found. The coach is now offered
  from outside, and consent is unchanged: nothing is sent until the notice is confirmed, and consent
  lasts for the session only.
- **Home card:** "Practice the N-400 interview with an AI coach" sits directly under the full
  interview card, with the owner's text ("The coach asks a follow-up like an officer might and gives
  tips on your English. Optional.") and "Powered by Claude (Anthropic)". It starts a single-part
  N-400 session and opens the consent notice as soon as the N-400 stage starts. The card is marked
  by a 3px teal frame and its own words, not by colour alone. The follow-up label in the feedback
  step stays "A practice follow-up question:" (spec C1). The content reviewer suggested softening
  "like an officer might"; kept as the owner's wording, open for the owner.
- **"AI" badge** on the N-400 part card: the word "AI" in a pill (`currentColor` border). Screen
  readers hear "AI coach (optional)" instead (reusing `coach.switch.label`), so the badge does not
  suggest the part always uses AI. `home.part.n400.badge` may equal English in every language (C5).
- **Choice screen:** every session that reaches the N-400 part asks "Would you like to use the AI
  coach?" before the first question, with "Use the AI coach" and "No, practice without AI" as two
  equal-size buttons (no nudge towards AI). "Use" opens the notice; Cancel returns to the choice
  (C3); "No" starts the scripted interview. The switch above the questions stays. Entry state is
  held by pure helpers (`src/ui/coach/coach-entry.ts`); "confirm" is reachable only from the notice.
- **Attribution: text only, no logo.** Source: Anthropic Trademark Guidelines,
  <https://www.anthropic.com/legal/trademark-guidelines> (read 2026-11-20): Anthropic's names, logos
  and brand elements may be used only as specifically permitted and in materials Anthropic has
  approved in advance; logo images are supplied on request; no use may imply sponsorship or
  affiliation; questions go to marketing@anthropic.com. Also read:
  <https://code.claude.com/docs/en/legal-and-compliance>. No public developer badge for apps that
  call the API was found, so no asset was added. "Powered by Claude (Anthropic)" appears as plain
  text on the home card, the choice screen, the consent notice and the feedback step (only after an
  AI reply, not on fallback lines). NOTICE item 8 and README say Claude and Anthropic are trademarks
  of Anthropic, PBC, and that Language Lab is not affiliated with, sponsored by or endorsed by
  Anthropic. "Claude" and "Anthropic" are in `FIXED_TERMS`.
- **Text:** new keys in all 14 locales (AI drafts, not legal keys). Draft fixes after review: zh
  "移民官" (immigration officer) to "面談人員"; pt "oficial" to "entrevistador"; vi and hmn
  "Powered by" no longer read as "Use Claude" (hmn still needs a Hmong reader).
- **Steering (C4, owner decision):** practice always uses a fictional profile, so no real personal
  data is spoken, typed or sent; the app also tells learners that in their real interview they must
  answer truthfully about their own life. `product.md` says this; `intro.privacy`,
  `n400.sample.note` and `coach.notice.text` (legal keys, English until reviewed) each say both
  halves; drafts and back-translations updated in 13 languages. `content-safety.md` rule 2 is
  unchanged: it already forbids suggesting what to claim.
- **Reviews:** `ui-reviewer`: focus was lost after Cancel (now back on "Use the AI coach"), long
  accessible names (now the title, with text and attribution as the description), notice spacing
  and a double rule, wrapping at 320px, the focus ring on the teal frame; all fixed. The translation
  label it asked about is already on every screen (Shell `AiNotice`). `content-reviewer`: no
  must-fix; the zh/pt/vi/hmn wording above and the badge fixed.
- **Layout check:** the choice screen, the home card's setup and its notice are recorded in the 10
  production languages at normal and extra-large text, at 390px and 320px: all pass.

## N. Release finish (2026-11-20, branch release/finish)
- **65/20 sources**: USCIS Policy Manual, Vol. 12, Part E, Ch. 2, Section E.2 (already saved; SHA-256
  in `data/sources/README.md`): bank of 20 designated questions, a 10-question test from the 2008 or
  2025 list by filing date, passed with at least six of 10. Also saved: Study for the Test, the 2025
  Civics Test page (states no 65/20 rule), Exceptions and Accommodations (native language with an
  interpreter). Quoted sentences: `data/sources/uscis-65-20-passages.txt`, tested against the pages.
- **No 65/20 early stop**: no source states one; the stop rules in the Policy Manual are stated for the
  standard tests. The two values stay `null` with `needsVerification: true`, and the practice asks all
  10 (`stopReason: "all_asked"`, practice score when at least 6 are correct). The mode needs only the
  three sourced values; it is off in every build if any of them loses its source.
- **Designated set**: `data/civics-65-20.json`, from the asterisks; a data test parses the 2025 text,
  the 2008 web page and the 2008 text independently. The practice uses the static ones only (17 for
  2008, 16 for 2025; dynamic questions are never practised, CR-003). Study first shows the same static
  ones and a legal line saying how many of the 20 change and where to check them.
- **Setup wording**: the owner's checkbox text is kept ("I am 65 or older and have been a permanent
  resident for 20 years or more"). The content reviewer suggested a practice-mode wording instead
  (rule 1); kept as the owner's choice, with "This only changes the practice; nothing is saved or
  sent" and a line to check uscis.gov for one's own case (age and years count at the time of filing).
  The label, the home card text and the help are legal keys (English until reviewed), as the reviewer
  advised for eligibility statements.
- **65/20 in the full interview**: the checkbox also appears on the full interview's setup and changes
  only the civics part. Reading and writing still run; a 65/20 applicant is exempt from the English
  test (Policy Manual table, 50/20 rule), which the app does not state. Open for the owner.
- **Report summaries (CON-04, CR-007)**: the English summary sentences were reworded to avoid plurals
  ("Civics questions answered correctly: 2 of 3"), so one key per line works in every language. The
  civics stop and score lines are legal keys like `civics.stopped.*`.
- **CON-07**: drafts kept; "tư vấn pháp lý", "юридическая консультация" and "aconselhamento jurídico"
  are the usual disclaimer terms, and the back-translations were literal. A note asks the native reader.
- **`civics.officialNote`**: its second sentence ("still waiting for a person to review it") was out of
  date since the answer-key review; removed in all 14 locales.
- **worker/ removed (SEC-08)** with `@cloudflare/workers-types`; nothing imported either.
- **Interaction tests (COR-01)**: jsdom 31.0.1, @testing-library/react 16.3.3, @testing-library/dom
  10.4.2, exact. A stubbed device voice makes the screens behave as in a browser; fetch is a spy.
- **Content review (Step 4)**: `docs/content-review.md` is generated by
  `tools/content-review/build-content-review.mjs`; no flag changed. It also covers `vocabulary.json`,
  which is flagged but was not in the owner's list.
- **Reviews**: `ui-reviewer` had no must-fix. Fixed: the Study 65/20 checkbox comes before the version
  buttons; forced-colours states for `aria-disabled` buttons and the desktop stepper; the new-tab note
  on the USCIS link; the 65/20 note after the answer box; spacing of the notes; the checkbox
  description limited to the rule; wrapping in choice labels. `content-reviewer`: fixed the judge
  guide's report labels (must-fix), the deploy caveat, the legal keys, the "in this practice" wording,
  the eligibility quote from the Policy Manual, the stale `civics.officialNote`. Left: the checkbox
  wording (owner's); `civics.heard.closest` could say the closest guess is kinder than a real
  interview; zh "答案範本" for "answer key" and vi wording (drafts for native readers).

## O. Dependency upgrades (2026-11-20, branch chore/upgrades)
- **Order and rule**: TypeScript, then Vite with plugin-react, then Vitest, then fast-check. Each was
  committed only after typecheck, the full tests, the build, the Pages Function esbuild bundle and the
  production layout check passed. No group needed a revert. The log is `docs/upgrade-log.md`.
- **Code changes**: `build.rollupOptions` → `build.rolldownOptions` in the speech-test config
  (Vite 8); `fc.fullUnicodeString()` → `fc.string({ unit: "binary" })` in two properties
  (fast-check 4's documented replacement). No test expectation changed.
- **esbuild as a dev dependency**: Vite 8 no longer installs it, and the Pages Function bundle check
  uses it. Pinned 0.28.2, inside Vite 8's peer range.
- **React stays 19.1.0**: no newer major exists; the minor update is not part of a major-upgrade
  branch.
- **Node 22.20.0 in `.node-version`**: CI's 22.18 failed 2 tests on `main` already, because
  `node:sqlite` binds numbered parameters only from 22.20. Raising the version fixes this without
  changing the test or the SQL (D1 supports `?NNN`). The same file pins Node for Cloudflare Pages.
  Its v2 build image defaults to Node 18, which Vite 8 does not support, and v3 ignores `engines`.
  `engines` and the README say 22.20+.
- **Not verified**: the GitHub Actions run itself (nothing pushed; reproduced locally with `npm ci` on
  Node 22.20.0), the Cloudflare Pages build image setting of the project, and a real deploy.

## P. Submission follow-up (2026-11-20, branch release/submission)
- **65/20 and the English test (Step 0)**: a new legal key `special.englishExempt` (English-only; AI
  drafts kept in the locale files for the reviewer) replaces `special.language`. It quotes the saved
  USCIS Exceptions and Accommodations page
  (https://www.uscis.gov/citizenship/exceptions-and-accommodations,
  `data/sources/uscis-exceptions-and-accommodations.html`): 50/20 and 55/15 are exempt from the
  English requirement but must still take the civics test, which they may take in their native
  language with an interpreter; 65/20 gets special consideration on civics. That page does not state
  that 65/20 is exempt from English, and neither saved source calls the 65/20 test "simplified".
  Two things come from the saved Policy Manual table
  (`data/sources/uscis-policy-manual-vol12-parte-ch2.html`): its 65/20 row says English "Exempt" and
  "specially designated test forms", and the chapter lists "read, write, speak, and understand". The
  line uses those words, not "simplified". It shows on the 65/20 setup, the first 65/20 civics
  question, Study first with 65/20, the 65/20 part report, and a 65/20 full report. It links the
  Exceptions page.
- **65/20 full interview skips reading and writing**: chosen over labelling them "optional English
  practice". The sources say a 65/20 applicant is exempt from the English requirement. Skipping
  matches that, and it leaves no parts in the report that do not apply. `modeParts(mode, special)`
  gives N-400 then civics; the stepper, the N-400 "Go to civics" button and the report follow it.
  The report builder accepts no reading or writing result, and the practice result then follows
  civics. Tests: engine unit and property tests (`special-consideration.test.ts`) and a DOM
  click-through (`interaction.test.tsx`).
- **Coach screening, addresses and ZIP codes (Step 2, audit F-08)**: `identifier-screen.ts` now also
  refuses:
  - a house number followed by one to three words and a street word (St, Street, Ave, Avenue, Rd,
    Road, Blvd, Dr, Drive, Ln, Lane, Way, Ct, Hwy);
  - a unit marker with a number (Apt, Unit, Suite, #);
  - a ZIP code next to a state code (capitals only) or a state name.

  The words between the number and the street word may not be common short words or time and count
  words, so "In 2015 we moved to a new street" passes. E-mail and phone were already covered. The
  fictional profiles' sample answers still pass (tested).

  **Names are not detected**: a name looks like any other word, and a list of names would block
  ordinary answers. The consent notice says so in a new legal key, `coach.notice.limits` ("...it
  cannot find names. Do not say or type a real person's name."), English until reviewed. The same
  screen runs on the client and again in the Pages Function.
- **Prominent disclaimer on result screens (Step 1, audit F-07)**: `disclaimer.report` in the prominent
  variant sits directly under the result on reading, writing and civics feedback (it replaces the short
  civics line) and on the N-400 summary. No new key: the existing legal key and its reviewer drafts are
  reused. The layout check now fails a result screen without it, with it above the result, or with the
  result out of view. It measures where the app leaves the page: each result screen focuses its result
  heading, which scrolls it into view. Measuring from the top of the page instead failed in vi at
  extra-large text, because of the AI-translation notice above the screen, not the disclaimer.
- **Loading shell (Step 3, audit F-01)**: static text inside `#root` (name, "Loading the practice
  booth…", the short disclaimer in English), styled by `src/ui/styles/boot.css`, which Vite merges into
  the main stylesheet; no inline style, so the CSP is unchanged. React replaces it on mount. No lazy
  split, because most of the main chunk is React DOM and shared engine code.
- **HSTS and the uscis.gov key strings (Step 4, audit F-04, F-03)**: `Strict-Transport-Security:
  max-age=31536000` without `includeSubDomains` or `preload` (the site is one Pages host). The saved
  uscis.gov pages keep their "AIza…" browser key strings unchanged (they are sources); the sources
  README explains them.

## 65/20 call to action is translated (owner decision, QA Q3)

The owner tested Home in Vietnamese: the 65/20 card's title was English inside a Vietnamese page,
because `home.special.cta` ("65 or older, 20 years with a green card? Start the 65/20 practice.") was a
legal key. Decision: the choice's title and short line are interface text, not legal text. They are
now normal keys with AI drafts in all 14 locales (`home.who.special.title` "65 or older, with a green
card for 20 years or more", `home.who.special.text`), and `home.special.cta` is removed from
`LEGAL_KEYS` and from the locales. Only the eligibility sentence (`home.special.text`) and the USCIS
rules (`intro.special.help`, `intro.special.label`, `special.englishExempt`) stay legal keys, English
until a person reviews the translation. The new Home asks "1. Who is practicing?" (Most people by
default, in memory only) and every later card uses that choice: Study starts with the starred
questions, and the practice test and civics start with 65/20 ticked in setup.

## Q. Age and residency exceptions: 50/20, 55/15 and 65/20 (branch ui/senior-friendly)

The owner asked why only 65/20 was offered. The saved USCIS sources give three exceptions, all
counted at the time of filing:

- `data/sources/uscis-exceptions-and-accommodations.html`: exempt from English "but are still
  required to take the civics test if you are: Age 50 or older at the time of filing for
  naturalization and have lived as a permanent resident (Green Card holder) in the United States for
  20 years (commonly referred to as the “50/20” exception). OR Age 55 or older … for 15 years
  (commonly referred to as the “55/15” exception)." and "You will be permitted to take the civics test
  in your native language."
- `data/sources/uscis-policy-manual-vol12-parte-ch2.html`, the table of exceptions: 50/20 and 55/15,
  English "Exempt", civics "Still required. Aliens may take civics test in their language of choice
  using an interpreter."; 65/20, English "Exempt", civics "Still required but officers administer
  specially designated test forms."

Mapping in the engine (`src/engine/exceptions.ts`; `exception: "none" | "50/20" | "55/15" | "65/20"`
replaces the boolean `specialConsideration` in the setup, the state and the `choose` and `start`
actions; the civics part report carries `exception`):

| Choice | Full interview parts | Civics pool and rules | Report |
|---|---|---|---|
| none | N-400, reading, writing, civics | the usual test of the version set by the filing date | unchanged |
| 50/20 | N-400, civics | the usual pool and rules (2008: 10 asked, 6 to pass; 2025: 20 asked, 12 to pass) | no English summaries |
| 55/15 | N-400, civics | the same as 50/20 | no English summaries |
| 65/20 | N-400, civics | the 20 designated questions, 10 asked, 6 to pass (unchanged) | no English summaries |

`englishExempt` is true for the three exceptions; `usesDesignatedSet` only for 65/20. A single part
keeps its own parts for every choice; the choice only applies to modes with civics, and 65/20 only
where the build has the designated list and its rules. The app practises the English questions only:
the interpreter rule is stated, never simulated. Wording comes from these saved pages only, not from
formN400.org or the N400 repository.

## R. A picture for every question where one helps (branch content/full-pictures)
Goal: every PERSON, PLACE, DOCUMENT, EVENT, SYMBOL or CONCEPT question (167 of 228, see
`docs/image-plan.md`) gets a picture; DYNAMIC and NONE questions (61) stay without one on purpose.
Result: 166 of 167 have a picture prepared, 152 are shown today, and 14 appear once the owner
reviews them (10 diagram pairings and the 4 questions of the 3 redone AI illustrations).
- **Diagrams drawn by code (new kind "diagram"):** no federal map item carried an item-level rights
  statement that `acceptableRights()` accepts (Library of Congress maps only have the Geography and
  Map Division's general wording), and the rule was not loosened. Maps and the flag are drawn instead
  by `tools/images/draw-diagrams.mjs` from U.S. Government works: the Census Bureau 1:20m states (2023),
  the 1:500k file for the four small territories, USGS National Atlas 1:1M streams for the Missouri and
  Mississippi, and for the 50-star flag 4 U.S.C. §§ 1-2 with the Executive Order 10834 proportions
  (`tools/images/flag.mjs`; a test counts 50 stars and 13 stripes in the drawing output). Legal basis
  "U.S. Government work, public domain (17 U.S.C. §105)". No text labels; one formN400 base style. The
  13-state map uses today's borders and says so in its caption. Source archives are recorded with URL,
  date and SHA-256 in `data/images/sources/sources.json`; only the 20m archive itself is kept, plus
  GeoJSON extracts of the two larger ones. Diagrams are shown only when `reviewed: true`, through the
  existing picture component with their credit line (the only UI change).
- **Memorials instead of war and attack photos:** World War II, Korea, Vietnam and September 11 get
  memorial photos (National WWII Memorial, Korean War Veterans Memorial, Vietnam Veterans Memorial,
  Flight 93 National Memorial), and the Great Depression gets the breadline sculpture at the FDR
  Memorial. No weapon in the foreground, no injured people, no attack photo. The Cold War gets the 1987
  INF Treaty signing (Reagan Library, National Archives "Unrestricted"); the Persian Gulf War gets USS
  Ranger coming home (National Archives "Unrestricted").
- **NPS source added:** `build-images.mjs` reads an NPGallery asset page and accepts it only when the
  page's own "Constraints Information" says "Public domain" and the photo credit is the National Park
  Service; the constraint is recorded word for word. The site-wide NPGallery copyright notice is not an
  item statement and is not recorded as one. The NPS Data API's public DEMO_KEY ran out after three
  parks, so the WWII Memorial and the July 4th fireworks come from the Library of Congress (Carol M.
  Highsmith, "No known restrictions on publication") instead of NPS; the NPGallery candidates for those
  two had no NPS photo credit.
- **Library of Congress rights given as a list:** some loc.gov records give `rights_advisory` as a
  one-item list. The builder and `find-loc.mjs` now use that item's text; `acceptableRights()` itself is
  unchanged.
- **Crops recorded as edits:** the John Jay engraving is cropped to leave out its printed name, and the
  Rothermel Pilgrims print to leave out the paper margin and its handwriting (rule: no text inside
  pictures). The crop is written into the manifest and the credits.
- **Documents are text by nature:** the Federalist page (2025-084), like the Constitution and the
  Declaration, is a page of print; it is a DOCUMENT picture, not a photo with stray text.
- **Still missing:** 2025-116 (a conflict after 2001): every National Archives candidate found breaks a
  rule (a rifle in the foreground, an eagle rating badge, or small "USN" letters on a cap badge);
  6645873 is the closest and is left for the owner to decide. The three redone AI prompts
  (paying-taxes, judicial-branch, two-term-limit) were dry-run only; the owner generates and reviews them.
- **Owner review:** `docs/image-review.md` lists every pairing (federal, diagram, AI) with an "Owner OK"
  column that the builder now keeps across rebuilds, and `docs/review-sheets/` holds one contact sheet
  per group.

## S. "Use my name": the learner's own name, on the device only (2026-11-27, branch feature/own-name)
Goal: a fourth card on the "Choose a practice character" screen lets the learner practise saying and
spelling their real name, the first thing the officer asks. Every other detail comes from the sample
profile Aurora Thistlewood, shown with the label "Sample profile".
- **Why the rule changed:** content-safety section 1 forbade asking for any real N-400 data, the name
  included. Saying and spelling one's own name is the most common opening of the interview and cannot be
  practised with an invented name. The owner chose option B: a narrow exception for the name alone, used
  only on the device and never sent out. Rejected: option A (send the real name to the AI coach, which
  would put real personal data with a third party) and option C (do not build the feature).
- **Why the privacy notice and NOTICE are unchanged:** no real data leaves the device, so what the
  privacy notice says about requests to the AI coach stays true.
- **How the name is kept on the device:**
  - It lives only in `PracticeApp` React state. It is never written to local or session storage, a
    cookie, the URL, history or the console, and it is cleared on restart and lost on reload.
  - The engine receives only the base profile id. `createOwnNameCoach` fills the name into the greeting
    and the sample answer to "What is your full name?" for display only.
  - Text that contains the name is spoken only by a local English device voice
    (`SpeechSynthesisVoice.localService`); recorded clips are skipped, and if no local voice exists the
    text is not spoken, because a network voice would send the name to a speech service.
  - The spelling question ("Can you spell your last name, please?") is local-only and never sent to the
    coach.
  - Before any answer goes to the coach, `protectNameForCoach` replaces the name with the sample name.
    When the name may still be there (letters spelled apart, or part of the name left over), the answer
    is not sent and the screen explains why.
  - The name field sits outside any form, with autocomplete, spellcheck and autocorrect off and the
    password-manager ignore attributes, because browser enhanced spellcheck can send typed text out.
- **Reminder on the practice screen:** "Do not say a real A-number, Social Security number or green card
  number when you practise."
- **Tests:** `src/ui/__tests__/own-name.test.tsx` checks that no request to `/api/coach` contains the
  typed name (both requests carry "Aurora Thistlewood"), that nothing is written to storage, cookie, URL,
  history or console, and that the name is gone after a reload. `src/engine/__tests__/own-name.test.ts`
  covers the name check and the coach protection, including property tests.
- **Languages:** every new string goes through i18n in all 14 languages. The new privacy, reminder and
  sample-profile lines are in `LEGAL_KEYS`, so they stay English until a named reviewer checks them.
  `intro.filed.help` also stays English (owner choice (a)); it is not translated.

## T. Three officer voices, one per practice (2026-11-27, branch feature/officer-voices)
Goal: a real interview has one officer, and learners meet different officers. Each practice now
uses one of three AI voices for the officer, chosen at random once and kept to the end.
- **Voices** (`TTS_SETTINGS` in `src/engine/audio-clips.ts`, now a list):
  - officer-a: `gpt-4o-mini-tts`, voice `coral`, the original instruction. Its files stay in
    `public/audio/<group>/` and its manifest entries are unchanged; nothing was regenerated.
  - officer-b: voice `cedar`. officer-c: voice `marin`. Same model, same instruction ("Speak clear
    American English slowly and naturally, like a patient interviewer."), default speed (no `speed`
    parameter), so the three differ only in the voice.
  - Why these two: the text-to-speech guide lists 13 built-in voices for `gpt-4o-mini-tts` and
    recommends `marin` and `cedar` for best quality. `cedar` sounds male and `marin` sounds female
    with a different tone from `coral`. The docs do not describe how the voices sound; this is a
    listening judgement and the owner should confirm it on openai.fm before the real run.
  - Sources, read 2026-11-27: https://developers.openai.com/api/docs/guides/text-to-speech (voice list,
    recommendation) and https://developers.openai.com/api/docs/models/gpt-4o-mini-tts (model page, prices:
    text input US$0.60 and audio output US$12.00 per 1M tokens, also on
    https://developers.openai.com/api/docs/pricing).
  - **Deprecation:** both pages say `gpt-4o-mini-tts` is deprecated and shuts down on 2027-01-06
    (successor `gpt-realtime-2.1-mini`, Realtime API only, not `/v1/audio/speech`). The committed MP3
    files keep working after that date because the app only plays static files, but no clip can be
    made or remade with this model after it. Generate officer-b and officer-c before then.
- **Clips:** officer-b and officer-c speak only the officer's lines: civics questions (both keys),
  N-400 questions, reading and writing sentences. Sample answers stay with officer-a. Files go to
  `public/audio/officer-b/...` and `public/audio/officer-c/...` with the same relative paths.
- **Manifest:** backward compatible. The top-level `tts` and `clips` are officer-a, as before. An
  optional `voices` object holds `officer-b` and `officer-c`, each with its own `tts` and `clips`,
  keyed by the same clip ids, and each entry names its `voice`. `parseManifest` refuses a sample
  answer, a file outside the voice's folder, or another voice's name in those sections.
- **Generator:** `--voice=officer-b|officer-c` (default officer-a). `--dry-run` prints the clip count,
  the character total and an estimated cost. The estimate takes the speech length from officer-a's
  MP3 of the same text (128 kbit/s) and assumes 20 audio tokens per second (1 token per 50 ms, from
  the Realtime cost guide; the TTS pages do not state it). Kiro ran it with `--dry-run` only; the
  owner runs the real generation.
- **App:** the officer is picked from the practice's seed when the practice starts
  (`pickOfficerVoice`, deterministic for tests) and kept in `PracticeApp` memory until Home or
  restart. Study first picks once per visit. The player tries the chosen voice's clip, then
  officer-a's clip, then the device voice. The "AI-generated voice" label is unchanged.
- **Setting:** "Officer voice" in the comfort settings: "A different officer each practice"
  (default) or "Always the same voice" (officer-a). In memory only, like the other comfort settings.
  These are interface keys, not legal keys.
