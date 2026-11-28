---
inclusion: always
---

# Language Lab — Content Safety Rules

These rules apply to all code, content, and AI-generated output in this project.
They are non-negotiable and take precedence over convenience or feature scope.

## 1. Fictional Profiles Only

Use fictional applicant profiles in all practice sessions, mock data, and examples.
Never ask users to enter real N-400 data (name, date of birth, address, immigration history,
or any personally identifiable information). No fake government ID numbers (A-numbers or
otherwise) appear anywhere in mock data or types.

**One narrow exception: the learner's own name.** The user may type their own name to practise
saying and spelling it ("Use my name"). The name is used only on the device and is never sent
out: it lives in memory for the session only (no storage, cookie, URL or log), it is spoken only
by a local device voice, and every request to the AI coach uses the sample profile's name instead.
Every other detail still comes from a fictional sample profile, and no other real data is asked for.
See `docs/decisions-log.md` section S.

## 2. Never Suggest What to Claim

Practice must teach users to answer truthfully from their own real circumstances.
The tool must never suggest what a user should claim, assert, or say on their application.
Feedback may say "try again" or "practice this section" but must never provide a suggested
answer that implies what the user's real situation should be.

## 3. Translation: English-only content, and AI-translated interface with safeguards

**Stays English, never machine-translated.** Civics questions, accepted answers and official
answer lines; reading and writing sentences; N-400 questions and their sample answers. These are
shown in English only, in every interface language. There are no translations of civics questions in
this repository: `data/translations/civics/` holds only the official English display text, and a test
fails if any non-English file appears there (they came from a separate project whose content is not
covered by this repository's licence, see `NOTICE`).

**The interface may ship in AI-translated languages** (`src/i18n/locales/<code>.json`, the 14
languages of `src/i18n/languages.ts`) when all three hold:

a. **Label.** Every screen shows a clear label, in the chosen language and in English, that the
   translation is AI-generated, may contain errors, and that English is the authoritative version.
   A language loses the label only when a named human reviewer and a review date are recorded in
   the `_meta` of its locale file (`reviewedBy`, `reviewedOn`).
b. **Disclaimer in English too.** In every non-English language the disclaimer is always shown
   together with its English text.
c. **Automated checks pass.** Same keys and `{placeholders}` as English, every number kept, fixed
   names unchanged (Language Lab, USCIS, N-400, DHS), no empty string, nothing left identical to
   English except an allow-list. The checks run as tests and again in the app: a locale that fails
   them is not offered.

A locale file records its `source` (`ai-draft` or `human-reviewed`). Setting `reviewedBy` and
`reviewedOn` is the reviewer's act, not the code's. The review sheets in `docs/locale-review/` list
every line for that review.

## 4. Civics Scoring is Deterministic — AI Must Not Score Civics

Civics answers are scored solely by comparing the user's response against the answer key
in `data/`. The scoring source is always `"answer_key"`. AI (LLM) must never decide whether
a civics answer is correct or incorrect. This rule exists to prevent hallucinated civics
scores and to ensure the tool never teaches incorrect civics facts.

## 5. Prominent Disclaimer Required

Every session report and every UI surface that shows practice results must display a
prominent disclaimer, for example:

> "This is a practice tool only. It is not affiliated with USCIS or any government agency.
> Results do not predict or reflect any official immigration decision. This is not legal advice."

This disclaimer is a required field (`disclaimer`) on the `FinalReport` type.

## 6. No Government Seals or Implied Endorsement

Do not use the USCIS seal, DHS seal, U.S. government eagle, or any official government
insignia. Do not use language that implies government endorsement, official status, or that
this tool is sanctioned by any agency. Styling should make clear this is an independent
third-party study aid.
