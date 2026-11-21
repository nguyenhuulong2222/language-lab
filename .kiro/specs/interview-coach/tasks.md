# Interview coach — Tasks

Order follows dependencies. After each task: `npm run typecheck` and `npm test` pass, then one
commit. No task calls the real Anthropic API.

## C-00 — Spec (done)
`requirements.md` (revision 2, with both Analyze Requirements rounds), `design.md`, this file.

**Status:** C-00 to C-05 done and committed. Open points are listed in `docs/decisions-log.md`
section L and in `docs/audit/open-findings.md`.

## C-01 — Config, identifier screen, deny-list, reply check
`data/coach-config.json`, `data/coach-deny-list.json`, `src/engine/coach/{types,config,
identifier-screen,reply-check}.ts` with unit and property tests.

## C-02 — Prompt, limits, counters
`src/engine/coach/{prompt,limits,counters}.ts`, `functions/coach-schema.sql`; counters tested on
`node:sqlite`.

## C-03 — Handler and Pages Function
`src/engine/coach/handler.ts`, `functions/api/coach.ts`, minimal Function types; endpoint tests
with a mocked model, including prompt-injection attempts and the Function's own headers.

## C-04 — Client and interface
`N400Coach.turnFeedback`, `src/ui/coach/*`, `CoachSwitch`, `CoachFeedback`, the N-400 feedback
step, locale keys in 14 languages (legal keys English only), privacy lines; tests that consent off
never calls `/api/coach`.

## C-05 — Docs and reviews
`docs/coach-deploy.md`, README disclosure, `NOTICE`, `structure.md` note, `ui-reviewer` and
`content-reviewer` with fixes, layout check, build, `decisions-log.md`, `kiro-log.md`.

## Revision 3 (branch ui/coach-discoverable)
- [x] D-00 Spec revision 3 (this update).
- [x] D-01 Home card and the "AI" badge on the N-400 part card.
- [x] D-02 Choice screen before the first N-400 question; shared `CoachNotice`; tests for both entry paths and "No".
- [x] D-03 "Powered by Claude (Anthropic)" text on the four surfaces; "Claude" and "Anthropic" in `FIXED_TERMS`; no logo.
- [x] D-04 Strings in 14 languages, review sheets.
- [x] D-05 Layout check for the new screens; `ui-reviewer` and `content-reviewer` with fixes.
- [x] D-06 Steering: fictional practice, truthful real interview.
