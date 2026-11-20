# Open findings after the fix pass (2026-11)

The finding ids are those of [`2026-11-audit.md`](2026-11-audit.md). Every finding not listed here was
closed in Steps 1 to 10 (see `docs/decisions-log.md`, section J). "Owner" means it needs a decision or
an action that this pass was not allowed to take (push, deploy, review data, change review flags).

## Still open

| Id | Severity | What is left | Why it is still open |
|---|---|---|---|
| CON-01 | Blocker | Both civics answer keys are still `needsHumanReview: true`, so civics, Study first and the full interview are off in production. | Owner: a person must review the keys. The flags were not changed, and the production check was not weakened. The dead end is gone (Step 7). |
| KIRO-01 | Blocker | `origin/main` is far behind this branch; the live site serves an older build (Google Fonts, no `_headers`). | Owner: this pass never pushes or deploys. |
| SEC-03 | High (rest) | Rotate the OpenAI key if any agent transcript could have captured it; keep keys outside the repository folder. | Owner action. The guard itself is fixed and tested (Step 4). It is a guard against accidents, not a security boundary. |
| CON-04 | Medium (rest) | The engine's stage summaries (`report-builder.ts`) are English in every interface language. | They are a `FinalReport` contract string; moving them to locale files needs a contract request. The wording now says "practice passing score". |
| CON-06 | Medium | Content loaders throw unless `needsHumanReview === true`, so reviewed content cannot be marked reviewed without a code change. | Owner decision on the end state (allow `false` once a reviewer is recorded; gate production on it or not). Changing it now would touch the review flags. |
| CON-07 | Medium (rest) | In vi, ru and pt, "legal advice" back-translates as "consultation" or "counseling". | Needs native readers. Those lines are shown in English until a reviewer is recorded, so users do not see the drafts. |
| COR-01 | Medium | UI tests are server-render only; no DOM environment, no coverage report, no worker test. | New test infrastructure (a DOM library and coverage tool) is more than a fix. Focus and keyboard behaviour is covered only by the Chrome layout check. |
| COR-04 | Low (rest) | The plural rule's 3-letter limit is still a constant in `sentence-compare.ts`. | The spelling limits moved to `practice-config.json` (Step 6). The plural limit is tied to `sameInflection`'s safety argument; moving it is a refactor. |
| SEC-07 | Low | `vite.speech-test.config.ts` binds `0.0.0.0` with the project root as server root. | Developer tool for phone testing; Vite's deny list returned 403 for the key file and `.git` in the audit. Changing it changes the owner's test workflow. |
| SEC-08 | Low | `worker/index.ts` `/api/health` has no CORS or rate limit. | The worker is not used by the app. |
| A11Y-11 | Low | Forced-colours mode: stepper fill, expanded header button and `.btn--active` rely on background colour. | Needs design work and a Windows high-contrast check on a device. |
| A11Y-12 | Low | Amber on `--surface-2` in light mode is 4.43:1. | Only icons use that pair, where 3:1 applies. No change needed. |
| A11Y-13 | Low | `StatusBadge` fixed line-height in tall scripts; very long words at 125% and 320 px. | The layout check found no overflow at 320 px; needs a check on a real phone. |
| CON-09 | Low | 65/20 passing score and early-stop values are `null` with `needsVerification: true`. | The quote that states 6 of 10 is not in the saved sources in `data/sources/`; save the source first. |
| CON-10 | Low | Civics feedback "You said" shows the best of the recogniser's guesses. | A deliberate, deterministic choice (no AI), documented in `decisions-log.md`. |
| CON-12 | Low | Wording points in th, hmn, hi, ko and my drafts. | Needs native readers. |
| CON-13 | Low | Picture records with creator "Unknown" and rights lines that point to further pages. | Needs a person to check the source records. |
| CON-14 | Low | No reminder next to the N-400 text box not to type real details. | New copy in 14 languages; `intro.privacy` and the fictional profile cover rule 1 today. |
| DEP-02 | Low | Major upgrades available (Vite 8, Vitest 5, TypeScript 7, plugin-react 6, fast-check 4). | Upgrades are not fixes; `npm audit` reports 0. |
| KIRO-03 | Low | GitHub repository description and homepage are empty. | Owner: GitHub settings. |

## Found by the reviewers in Step 10 and left open

| Source | Severity | What | Why |
|---|---|---|---|
| content-reviewer | Medium | An assisted writing attempt (sentence shown) still counts toward the practice result; the full report says so only in the writing summary line. | My decision (Step 5): a practice route, not a penalty. The owner may prefer not to count it. One line in `practice-flow.ts` and `report-builder.ts` would change it. |
| content-reviewer | Low | `compare.setting.writing` does not say that words of 3 letters or fewer must be exact. | Changing the English line makes all 13 drafts stale; the config states it. |
| content-reviewer | Low | `report.title.onTrack` "Practice complete: each part reached the practice score" joins two ideas. | Wording preference; it predicts nothing. |
| content-reviewer | Low | `home.lead`, `setup.lead`, `study.lead`, `help.skip` make light data-handling or scoring claims and stay translated. | Borderline; recorded as a decision to keep them translatable. |
| ui-reviewer | Low | With no voice at all, the writing screen shows three notes. | Each says something different (no audio, the sentence is shown, the attempt is assisted). |
| ui-reviewer | Low | The answer status line switches its role between status and alert. | The empty-answer message is still read (the box is focused and described by it). |
| ui-reviewer | Low | N-400 "Try again" disappears on retry, so focus is lost; the loading status may not be announced. | Rare path (the questions are a local file). |
| ui-reviewer | Low | The font credit is English in every language. | A proper name and a licence title. |
| audit evidence | Low | `docs/audit/evidence/probe-locked.mjs` still clicks "Aurora Vance". | It is the audit's evidence as it was run; left unchanged. |

## Not verified in this pass

- No real iPhone or Android device; no screen reader.
- The Cloudflare `_headers` file was not served by Cloudflare (no deploy). The same values were applied by the probe and by `layout-check --prod`.
- The slow-network probe (PERF-02) was not run again after self-hosting the font.
- The CI workflow has not run on GitHub (nothing was pushed).
- The surname "Thistlewood" was checked against officeholders from memory, not a database.
