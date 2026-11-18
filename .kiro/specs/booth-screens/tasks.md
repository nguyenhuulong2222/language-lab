# Booth screens — Tasks

One commit per task. After each: `npm run typecheck` and `npm test` pass.

**Status:** B-01 to B-10 done. Not done: pre-generated audio, the Worker coach, N-400 scoring, a test in a real browser with a microphone.

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
