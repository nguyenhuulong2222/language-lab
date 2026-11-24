# Open findings after the fix pass (2026-11)

The finding ids are those of [`2026-11-audit.md`](2026-11-audit.md). Every finding not listed here was
closed in Steps 1 to 10 (see `docs/decisions-log.md`, section J). "Owner" means it needs a decision or
an action that this pass was not allowed to take (push, deploy, review data, change review flags).

## Still open
| Id | Severity | What is left | Why it is still open |
|---|---|---|---|
| SEC-03 | High (rest) | Rotate the OpenAI key if any agent transcript could have captured it; keep keys outside the repository folder. | Owner action. The guard itself is fixed and tested (Step 4). It is a guard against accidents, not a security boundary. |
| COR-01 | Medium | UI tests were server-render only. | Closed in release/finish Step 3 if that step is committed (see below). |
| DEP-02 | Low | Major upgrades available (Vite 8, Vitest 5, TypeScript 7, plugin-react 6, fast-check 4). | Left for the separate upgrade branch (owner). |
| KIRO-03 | Low | GitHub repository description and homepage are empty. | Owner: the release/finish report gives one `gh repo edit` command to run. |

## Closed in release/finish (2026-11-20)
| Id | How |
|---|---|
| KIRO-01 | Owner: `main` is merged and deployed (https://language-lab-ade.pages.dev). |
| CON-09 | Step 1. The 65/20 values come from the USCIS Policy Manual, Vol. 12, Part E, Ch. 2 (saved, SHA-256 in `data/sources/README.md`): bank 20, 10 asked, 6 to pass. No source states an early-stop rule, so those two values stay `null` with `needsVerification: true` and the 65/20 practice asks all 10. The designated questions are `data/civics-65-20.json`, tested against the asterisks of all three official lists. |
| CON-04 | Every report stage summary also carries its lines as message keys with the numbers as placeholders (`StageSummary.summaryLines`, CR-007). The report screen renders them through the locale files; in English they equal `summary` (tested). The two English review items are translated the same way. Question texts stay English; the disclaimer stays English-only. |
| CON-06 | `src/engine/review-flag.ts`: practice content, the practice config and the picture pairings load with `needsHumanReview: false` once `reviewedBy` and an ISO `reviewedOn` are present, the same rule as the answer keys. No flag was changed. |
| CON-07 | The missing back-translation keys were added in the fix pass. "Legal advice" in vi ("tư vấn pháp lý"), ru ("юридическая консультация") and pt ("aconselhamento jurídico") is the usual term in disclaimers; the back-translations were literal. A note in each review sheet asks the native reader to confirm. The lines stay English until a reviewer is recorded. |
| CON-10 | The civics feedback note says, after a voice answer with several guesses, that the guess closest to an answer in the key is shown (`civics.heard.closest`). |
| CON-12 | Drafts corrected where the audit named the problem: th `disclaimer.full` ("endorsed", not "certified"), hi `lang.interviewEnglish` ("exception", not "exemption"), ko `compare.counts`, my `compare.notYet`; recorded under `fixed` in `back-translations.json`. hmn "qauv" for "profile" is left with its note for a Hmong reader (Hmong is hidden in production). All drafts still need native review. |
| CON-13 | The picture records with creator "Unknown" and rights lines that point to further pages are items in the owner's checklist `docs/content-review.md` (Step 4). |
| CON-14 | A reminder under the N-400 answer box, read with it: "Answer as the fictional person. Do not type your real name, address, dates or numbers." (`n400.box.reminder`, a legal key). |
| COR-04 | The plural limit is `sentenceMatch.pluralMinLetters` (3) in `practice-config.json`; the loader checks it. |
| SEC-07 | `vite.speech-test.config.ts` binds 127.0.0.1 with `server.fs.strict`; `npm run speech-test -- --host` opens it to a phone for one run. |
| SEC-08 | The unused `worker/` placeholder and `@cloudflare/workers-types` were removed; steering (`structure.md`, `tech.md`) and README name `functions/` instead. |
| A11Y-11 | `@media (forced-colors: active)` rules: the stepper bar has an outline and a `Highlight` fill, an open header button has a thicker frame and an underline, `.btn--active` uses `Highlight` with a double frame. Not yet checked on a Windows device. |
| A11Y-12 | The accent-on-background pairs are in `design-system.md`; light amber on `--surface-2` (4.43:1) is recorded as icons only. |
| A11Y-13 | `StatusBadge` uses `var(--lh-snug)`; `.btn` and `.option-card` have `overflow-wrap: anywhere`. Not yet checked on a real phone. |

## Closed after the fix pass

| Id | Closed on | How |
|---|---|---|
| CON-01 | 2026-11-20 | The project owner reviewed both answer keys (the interpreted questions and the dynamic list, with an AI pre-review). The decisions are in `tools/answer-key/answer-markers.json`; the independent check `tools/answer-key/check-against-source.py` finds 0 mismatches (`docs/answer-key-source-check.md`). Both files now say `needsHumanReview: false` with `reviewedBy` and `reviewedOn`, recorded through `tools/answer-key/review.json`, which is tied to the SHA-256 of the reviewed entries. The production build unlocks civics, Study first and the full interview; verified with `layout-check --prod` for both test versions. |

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

## AI coach (branch engine/interview-coach), open

| Item | Why open |
|---|---|
| Anthropic retention terms for API data | Owner decision; the notice links Anthropic's privacy policy. |
| Names, street addresses, receipt and passport numbers are not screened | Only number shapes are screened; the notice asks learners to answer as the fictional person. |
| Officeholder deny-list | Best effort; must be updated when officeholders change. |
| Per-session turn cap is advisory on the server | No accounts; per-IP and daily limits are the server guards. |
| The coach notice is long and English only in unreviewed languages | Legal key; needs the owner's wording review and a native reviewer. |
| No dedicated Privacy screen | Privacy lines are on the home, setup and About surfaces. |
| No live test against the real API or Cloudflare | Not deployed; the secret and bindings are the owner's to create. |

## Not verified in this pass

- No real iPhone or Android device; no screen reader.
- The Cloudflare `_headers` file was not served by Cloudflare (no deploy). The same values were applied by the probe and by `layout-check --prod`.
- The slow-network probe (PERF-02) was not run again after self-hosting the font.
- The CI workflow has not run on GitHub (nothing was pushed).
- The surname "Thistlewood" was checked against officeholders from memory, not a database.
