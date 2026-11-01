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

## 2. Never Suggest What to Claim

Practice must teach users to answer truthfully from their own real circumstances.
The tool must never suggest what a user should claim, assert, or say on their application.
Feedback may say "try again" or "practice this section" but must never provide a suggested
answer that implies what the user's real situation should be.

## 3. No Machine Translation of Civics or Legal Content

Vietnamese text (and any other non-English language text) appears in this project only if it
comes from human-reviewed translation files stored in `data/translations/`.
Machine translation (including AI-generated translation) must never be used for civics
questions, legal notices, disclaimers, or instructional content.

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
