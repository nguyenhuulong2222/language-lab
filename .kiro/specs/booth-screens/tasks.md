# Booth screens — Tasks

One commit per task. After each: `npm run typecheck` and `npm test` pass.

**Status:** B-01 to B-22 done; B-23 to B-30 in progress.

## B-01 Practice content and sources (done)
USCIS reading and writing vocabulary saved in `data/sources/` (URL, SHA-256), `data/practice/`
(vocabulary, reading and writing sentences, fictional profiles, N-400 script, practice config), all
marked `needsHumanReview`. Loader and validation in `src/engine/practice-content.ts`,
`practice-config.ts`. Tests: every sentence word is in its vocabulary list; profiles are fictional;
every profile has a sample answer for every N-400 question.

## B-02 Sentence comparison (done)
`src/engine/sentence-compare.ts`. Unit and property tests.

## B-03 Recognition outcomes and N-400 coach (done)
`src/engine/recognition-outcome.ts`, `src/engine/n400-coach.ts`. Tests.

## B-04 Practice flow (done)
`src/engine/practice-flow.ts`: reducer, selection, session, report, production lock. Unit and
property tests, including the full flow through the real engine.

## B-05 UI foundation (done)
`src/ui/voice/`, shell, take header, answer input, speak button, sentence diff, i18n keys, styles.

## B-06 Intro and N-400 screens (done)

## B-07 Reading and writing screens (done)

## B-08 Civics screen, report and PracticeApp wiring (done)
`src/main.tsx` renders `PracticeApp`.

## B-09 Reviews and fixes (done)
Run the `ui-reviewer` and `content-reviewer` agents, fix findings.

## B-10 Docs and final checks (done)
`docs/kiro-log.md`, decisions, production behaviour notes, typecheck, test, build.

## B-11 Home and section choice (done)
Engine: modes, `sessionSteps`, `PartReport`, flow changes, CR-006. UI: home screen, setup per part,
stepper per session, part report screen. Unit and property tests.

## B-12 Instructions (done)
`HowItWorks`, `ScreenHelp`, help text in `en.json`.

## B-13 Comfort settings (done)
Settings provider and panel in the header, text size, slower playback, Play again, 48px targets,
layout checks at 390px.

## B-14 Vietnamese interface (done)
Language switcher, `vi.json` (draft, `needsHumanReview`), production gate, `docs/vi-locale-review.md`,
key and placeholder parity test, layout checks in both languages.

## B-15 Reviews and docs (done)
`ui-reviewer` and `content-reviewer`, fixes, decisions-log and kiro-log.

## B-16 Policy
Update `content-safety.md` rule 3, `tech.md`, README and `docs/decisions-log.md`: the interface may ship
AI-translated when labelled, with the disclaimer also in English, and when the checks pass.

## B-17 Languages
Locale files for all 14 languages with `_meta`; the gate becomes "passes the checks"; the AI label
banner; bilingual disclaimers; the Vietnamese-only build plugin is removed.

## B-18 Language picker
Header language menu, `lang` and `dir` on the document, system font stacks per script.

## B-19 Automated checks
`locale-checks.ts` and its tests for every locale; back-translation pass of the legal lines.

## B-20 Vietnamese wording
"Chào mừng đến Language Lab", "phòng luyện tập" instead of "buồng", and a full re-read for unnatural
word-for-word phrasing.

## B-21 Review sheets and layout
`docs/locale-review.md` and one sheet per language; `npm run layout-check` for all 14 languages at
normal and extra-large text; README disclosure.

## B-22 Reviews and docs (done)
`ui-reviewer` and `content-reviewer`, fixes, `tasks.md`, `kiro-log.md`.
## B-23 Spec for pictures
BS-20 and BS-21 in requirements, design and tasks.
## B-24 Picture tools and checks
`find-loc.mjs`, `build-images.mjs`, `question-images.ts`, manifest and mapping schema with tests.
## B-25 Pictures
Find, download, convert and record up to 40 pictures from loc.gov items with an accepted rights
statement; `docs/image-todo.md` for any that fail.
## B-26 Mapping
`question-images.json` (needsHumanReview), `docs/image-review.md`, mapping tests.
## B-27 Pictures in feedback
`QuestionPicture`; shown only after grading; tests that the question view never renders one.
## B-28 Study first
Home option, `StudyScreen`, version choice, one question at a time with audio and official answers.
## B-29 Credits and README
Credits screen from the footer, `docs/image-credits.md`, README disclosure.
## B-30 Reviews and docs
`ui-reviewer` and `content-reviewer`, fixes, `tasks.md`, `decisions-log.md`, `kiro-log.md`.
