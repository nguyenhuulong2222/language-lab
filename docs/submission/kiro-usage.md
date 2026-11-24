# How Kiro was used to build Language Lab

Every statement here can be checked in the repository; file paths and commit hashes are given.
The project started on 2026-11-01 (`bd9d256`, `3396e8e`). The work ran in Kiro IDE sessions, with Kiro
sub-agents for reviews. No MCP server and no Kiro power was configured (there is no
`.kiro/settings/mcp.json`), so neither is claimed.

## 1. Steering: six files, all `inclusion: always`

| File | What it set | How it changed the work |
|---|---|---|
| `.kiro/steering/content-safety.md` (`3396e8e`, `5c57e27`, `a375670`) | Fictional profiles only; never suggest what to claim; no machine translation of civics or legal text; civics scored only by the answer key; a disclaimer on every result; no government seals | Rule 4 is why scoring is deterministic: `src/engine/civics-grader.ts` compares against `data/civics-answers/` and the AI coach never scores (`src/engine/coach/`). Rule 3 produced the "legal keys" mechanism (`src/i18n/legal-keys.ts`): disclaimers stay English until a named reviewer is recorded. Rule 5 is the required `disclaimer` field of `FinalReport` (`src/contracts/session.ts`). The rule was changed once, by an owner decision, to allow labelled AI interface translations (`5c57e27`, decisions log G) |
| `.kiro/steering/product.md` (`3396e8e`, `642cb3e`) | What the tool is and is not, audience, tone | The owner's decision on "fictional practice, truthful real interview" was written here (`642cb3e`). The same day, `intro.privacy`, `n400.sample.note` and `coach.notice.text` were reworded to say both halves |
| `.kiro/steering/design-system.md` (9 commits from `1d208f2`) | The "Reel-to-Reel" tokens, an 18px body floor, 48px targets, contrast tables, status never by colour alone | `src/ui/styles/tokens.css` implements it; the `ui-reviewer` agent checks against it. The contrast table for icon pairs was added in `087b981` (audit A11Y-12) |
| `.kiro/steering/frontend-design.md` (`f00d1a9`, `2d623ee`) | Anthropic's "frontend-design" skill (MIT), with attribution | It set the plan-then-critique process for the UI and the tells to avoid. Disclosed in README and NOTICE |
| `.kiro/steering/structure.md` (6 commits) | Folder roles; `src/contracts/` changes need an entry in `docs/contract-requests.md` first | Contract requests CR-001 to CR-007 were each written before the contract changed. CR-006 was not made; a local type was used instead. CR-007 (report lines as message keys) is the latest |
| `.kiro/steering/tech.md` (`3396e8e`, `5c57e27`, `087b981`) | Stack, no secrets in source, deterministic civics scoring, Vitest with fast-check | Pinned the testing approach. Updated when the unused `worker/` was removed (`087b981`) |

## 2. Specs: requirements, design and tasks before code

| Spec | Folder | Scope |
|---|---|---|
| Grading | `.kiro/specs/grading/` (`9d47dd1`) | Test-version choice, civics scoring, normalisation, early stop, report, answer key build (tasks T-01 to T-09) |
| Booth screens | `.kiro/specs/booth-screens/` (`5704557`) | The practice flow, voice, prompts, languages, pictures, Study first, fair scoring (BS-01 to BS-25) |
| Interview coach | `.kiro/specs/interview-coach/` (`672b0d3`) | The optional Claude coach: consent, limits, Pages Function, D1 counters; revision 3 made it discoverable (C-00 to C-05, D-00 to D-06) |
| Release finish | `.kiro/specs/release-finish/` (`ba4cd8d`) | 65/20, the open audit findings, interaction tests, content review, judge path |

Each spec has "Context confirmed from the code", numbered requirements and a design. `tasks.md` lists
one commit per task. Moments where the requirements work caught a real defect before any code:

1. **The model API would have rejected every request.** Interview coach, Analyze Requirements A1
   (`.kiro/specs/interview-coach/requirements.md`): the brief asked for `temperature` in the config,
   but the current Anthropic API version rejects it with a 400. Settled as REQ-C04: the key is kept,
   must be `null`, and is never sent.
2. **Earlier answers would have been sent to the AI.** Round 2, finding B8, by an independent reviewer
   in a clean context: the N-400 coach interface passes `context.answered` (all earlier answers).
   Sending it would break the "current answer only" rule. REQ-C01 restricts the request to the current
   turn, and a test checks that earlier answer text never appears in the request body
   (`src/ui/__tests__/ai-coach.test.tsx`, "earlier answers are never sent").
3. **The spend cap could overshoot, and a fixed salt would be reversible.** A7 and B15: concurrent
   requests could pass the daily cap together, and a fallback salt would let IP hashes be reversed.
   Settled as an atomic reserve-then-settle in D1 (`src/engine/coach/counters.ts`) and a required
   secret salt (REQ-C12). Tested on real SQLite (`prompt-limits-counters.test.ts`).
4. **One answer could count twice.** Grading, resolved issue O2: with accepted answers "speech" and
   "freedom of speech", the response "freedom of speech" could have counted as two answers for a
   question that needs two. REQ-04 counts only non-overlapping spans; property P10 checks it.

## 3. Hooks (`.kiro/hooks/`, `2d623ee`, guard rewritten in `4af3a46`)

| Hook | Trigger | What it ran |
|---|---|---|
| `block-sensitive-paths.json` | PreToolUse on file and shell tools | `.kiro/hooks/scripts/block_sensitive_paths.py` blocks any call that names the env file, the Cloudflare dev-vars file or a private folder. The audit found the first version matched raw text (it blocked `environment.ts` and missed some variants). It was rewritten to match real path segments, with 21 test cases (`npm run test:hooks`, also in CI). It blocked agent calls many times during later work, including calls whose regular expressions only looked like those paths |
| `typecheck-on-ts-save.json` | PostFileSave on `.ts`/`.tsx` | `npm run typecheck` |
| `test-on-engine-contracts-save.json` | PostFileSave under `src/engine/` or `src/contracts/` | `npm test` |

## 4. Custom agents (`.kiro/agents/`, `2d623ee`)

Both are read-only (`read_file`, `read_code`, `grep_search`, `file_search`) and load the steering files
as resources. They ran as sub-agents in the Kiro IDE after each feature.

- **`content-reviewer`** checks civics and legal content against uscis.gov (it can web search) and the
  content-safety rules; it reports UNVERIFIED for anything it cannot confirm. Real findings it
  produced:
  - "your voice is never sent" in the coach notice was too absolute, because browser speech
    recognition may process audio (decisions log L).
  - The Hmong `header.about` read "About us and warning" (audit CON-02).
  - The judge guide named report labels the app does not show (decisions log N, must-fix).
  - `civics.officialNote` still said the answer list awaited review after the review was done
    (decisions log N).
- **`ui-reviewer`** checks layout, text size, contrast and accessibility against `design-system.md`.
  Real findings:
  - The coach result was probably never announced to screen readers: the live region mounted with its
    content (decisions log L).
  - Focus was lost after Cancel on the consent notice (decisions log M).
  - `aria-disabled` buttons and the desktop stepper had no forced-colours state (decisions log N).

The audit of November 2026 (`docs/audit/2026-11-audit.md`, `f9957ab`) used both agents next to its
own checks: 48 findings (2 blockers, 6 high). The fix pass is commits "Step 0" to "Step 10"
(`e8e553d` and earlier); `docs/audit/open-findings.md` tracks every item.

## 5. Property-based tests (fast-check, through `@fast-check/vitest`)

104 `fc.assert` properties in 23 test files. The ones that matter most:

- **Grading** (`.kiro/specs/grading/requirements.md`, P1 to P17):
  - A civics stage below the passing score is never "practice passed" (P1).
  - Every date maps to exactly one test version, with the boundary at 2025-10-20 (P2, P3).
  - The stage stops exactly at the thresholds and never scores more than the questions asked (P4, P5).
  - Dynamic questions are always unscored (P8).
  - Overlapping answers never double-count (P10).
  - Numbers in words and digits match each other from 0 to 999,999 and ordinals from 1 to 9,999, and
    different numbers never match (P13 to P15).
- **Normaliser**: normalising is idempotent, and its output has only a-z, 0-9, apostrophes and single
  spaces, for any Unicode input (`answer-normaliser.test.ts`).
- **65/20**: for any seed and any 10 answers, the practice asks 10 and reaches the practice score
  exactly when 6 or more are right; a missing stop rule never stops early
  (`special-consideration.test.ts`).
- **AI coach**: the identifier screen and the reply checks hold for generated input; `n` increments
  under a limit pass exactly `min(n, limit)` times on SQLite (`prompt-limits-counters.test.ts`).

The logs record no case where a property test found a bug that unit tests had missed, so none is
claimed here. The properties were written from the spec's requirements and pin them down.

## 6. The answer key, built and checked against USCIS sources

- **Sources**: saved unchanged in `data/sources/` with URL and SHA-256 (`data/sources/README.md`).
  They are the 2025 list (M-1778 PDF), the 2008 web page and its 01/19 text, and the Policy Manual
  chapter.
- **Build**: `tools/answer-key/build-answer-key.mjs` parses the sources into
  `data/civics-answers/2008.json` (100) and `2025.json` (128). Owner decisions for parentheses,
  alternatives and any-order answers are in `tools/answer-key/answer-markers.json`; the build fails if
  a decision matches no source line.
- **Independent check**: `tools/answer-key/check-against-source.py` has its own parser and normaliser,
  with no shared code. Result: 0 mismatches for both versions (`docs/answer-key-source-check.md`,
  `8cf7654`).
- **Review record**: `tools/answer-key/review.json` ties the owner's review to the SHA-256 of the
  reviewed entries. A rebuild that changes an entry invalidates it, and the loader then locks civics
  in production again.
- **Data tests** re-read the sources on their own: counts, numbering, dynamic questions, and every
  accepted word in its source line (`civics-answer-data.test.ts`). The 65/20 designated set is checked
  against the asterisks of all three official texts (`special-consideration-data.test.ts`).

## 7. Dependency upgrades with a gate (`docs/upgrade-log.md`)

TypeScript 5.8 → 7.0, Vite 6 → 8, plugin-react 4 → 6, Vitest 4 → 5 and fast-check 3 → 4 were done one
commit per group (`d3e0af4`, `f7a37de`, `46ed8a5`, `46b3141`). Each group was committed only after
typecheck, all 1373 tests, the build, the Pages Function bundle and the production layout check
passed. The same checks showed that CI's Node 22.18 could not run the D1 counter test, because
node:sqlite binds numbered parameters only from 22.20; Node was pinned in `.node-version`
(`1f55562`, `482a599`).

## 8. Working pattern

- One branch per feature, one commit per step, no pushes by the agent.
- The owner merged through pull requests (#1 to #8).
- Logs: `docs/kiro-log.md` (what was built), `docs/decisions-log.md` (why, sections A to O),
  `docs/contract-requests.md`.
