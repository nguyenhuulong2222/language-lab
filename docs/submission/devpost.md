# Language Lab — Devpost text

**Category:** Resurrection. **Team:** Long Nguyen and Tiffanie.
**App:** <https://lab.formn400.org> (free, no login; backup <https://language-lab-ade.pages.dev>).
**Code:** <https://github.com/nguyenhuulong2222/language-lab> (MIT).

## Inspiration

Many older immigrants prepare for the naturalization interview alone, from a printed list of civics
questions. What they lack is repetition out loud: hear a question, answer it, and learn right away
whether the answer counts. In the 1970s, schools did this in the language lab: rows of booths with
headphones and a tape deck, where a student listened, spoke and played the tape again. We brought that
booth's method back as a web app for a phone, in the clean navy-and-white style of formN400.org.

## What it does

Language Lab is a free practice booth for the U.S. naturalization interview, made for older learners
of English. It is an independent study aid: it is not affiliated with USCIS, is not legal advice and
predicts no result. Every practice uses an invented profile, so nobody enters real personal details.
The app also tells learners that in their real interview they must answer truthfully about their own
life.

- **The four parts of the interview**: the N-400 conversation, reading, writing and civics. Practise
  one part, or the full interview with one report.
- **Scored by the answer key, not by AI**: civics answers are checked against an answer key built from
  the official USCIS lists (2008 and 2025; the filing date picks the version), with the official stop
  rules. Reading and writing use a comparison rule based on the USCIS Policy Manual. A near miss, such
  as a plural, is explained and still counts. The report says "Practice score reached" or "Worth
  reviewing", never pass or fail.
- **Voice first, typing always works**: speak or type every answer. Spoken prompts were generated in
  advance with OpenAI text-to-speech and are labelled "AI-generated voice". No speech service is
  called while the app runs.
- **Optional AI coach (Claude)**: in the N-400 part, the coach gives a clarity label, one English tip
  and a practice follow-up question.
  - It is off by default, and nothing is sent until the learner confirms a consent notice, for one
    practice only.
  - Only the current answer's text goes to Anthropic's API, through the site's server. Text that
    looks like an A-number, a Social Security number, a phone number, an e-mail address or a full date
    is refused first.
  - Replies are checked before they are shown. The limits are 12 turns per practice, 30 requests per
    IP address per hour and 80 per day, and 600 requests or US$0.50 per day overall.
  - The coach never scores anything.
- **50/20, 55/15 and 65/20 exceptions**: the three USCIS age and residency exceptions. Each skips
  reading and writing in the full interview (USCIS exempts them from the English test); 50/20 and
  55/15 take the usual civics test, and 65/20 takes 10 of the 20 starred questions, with 6 correct
  for the practice score (USCIS Policy Manual, Vol. 12, Part E, Ch. 2). A linked line quotes the
  USCIS rules, including taking civics in their own language with an interpreter.
- **Study first**: the civics questions with official answers and pictures, not scored.
- **Interface languages as labelled AI drafts**: 10 of 14 languages are shown in production. Each says
  it was translated by AI. Disclaimers, legal lines and civics questions stay in English.
- **Federal public-domain pictures**: 18 pictures from the Smithsonian (CC0) and the Library of
  Congress, shown after an answer is graded, each credited with its rights line.
- **Comfort**: text up to 125%, slower voices and 48-pixel targets.

## How we built it

**Kiro first.** Six steering files set the rules before code. The content-safety rules (fictional
profiles, no machine-translated legal text, civics scored only by the answer key) shaped the
architecture, and a design-system file set the tokens (now the clean navy-and-white formN400 style).

Four specs (grading, booth screens, interview coach, release finish) gave numbered requirements, a
design and one commit per task. Requirements analysis caught defects before code:
- The model API would have rejected every request because of `temperature`.
- The coach would have sent all earlier answers.
- Concurrent requests could have overshot the spend cap.
- "Freedom of speech" could have counted as two answers.

Three hooks ran a typecheck on save, the tests on engine saves, and a guard that blocks tool calls
naming secret files. Two read-only custom agents, `content-reviewer` and `ui-reviewer`, reviewed each
feature against uscis.gov, the safety rules and the design system; a 48-finding audit was then closed
item by item. There are 1373 tests, including 104 fast-check properties. One script builds the answer
key from the saved USCIS documents; a second, independent one finds 0 mismatches in 228 questions.

Stack: React 19, TypeScript 7, Vite 8, Vitest 5 and Cloudflare Pages with a strict CSP. The coach runs
as a Pages Function with D1 counters.

## Challenges

- Scoring speech fairly without AI: "twenty-seven" must equal 27, and a different number must never
  match.
- Honest legal text in 14 languages: legal lines stay English until a named reviewer is recorded.
- Making the coach easy to find without weakening consent.
- 65/20: no USCIS source gives a stop rule, so the practice asks all 10.

## Accomplishments

- An answer key traced to USCIS documents, independently checked, with the owner's review tied to a
  hash.
- An AI feature that is off by default, sends nothing before consent and never scores.
- A layout check of the production build in every production language, with the real security
  headers.

## What we learned

Steering and specs paid off most where the stakes were high. Writing "AI must never score civics"
into steering on day one meant nothing had to be removed later. Review in a clean context found
problems the author had read past.

## What's next

- Native-speaker review of the translations.
- A person's review of the practice content (`docs/content-review.md`).
- Testing with ESL classes.

## Built with

Kiro (IDE, specs, steering, hooks, custom agents), TypeScript, React, Vite, Vitest, fast-check,
Cloudflare Pages, Pages Functions, D1, Anthropic Claude API, OpenAI text-to-speech (pre-generated),
the Web Speech API, and public USCIS, Smithsonian and Library of Congress material.

## Pre-existing work and third-party material

- **USCIS documents** (`data/sources/`): public U.S. government publications, saved unchanged with
  URL and SHA-256.
- **Design guidance**: `.kiro/steering/frontend-design.md` is Anthropic's "frontend-design" skill (MIT),
  agent guidance only.
- **Pictures**: public-domain or CC0 works from the Smithsonian, the Library of Congress and the
  National Archives, credited in `docs/image-credits.md` and in the app.
- **Illustrations**: some illustrations of abstract ideas (CONCEPT questions only) are AI-generated
  with the OpenAI image model `gpt-image-2.6-flare` from prompts in this repository
  (`data/images/illustration-prompts.json`). They are labelled "AI-generated illustration" on screen
  and are reviewed by the owner before they are shown.
- **Fonts**: Playfair Display (Claus Eggers Sørensen) and Source Serif 4 (Frank Grießhammer, Adobe),
  SIL Open Font License 1.1, self-hosted.
- **Audio**: prompts generated in advance with OpenAI `gpt-4o-mini-tts`.
- **Translations**: AI drafts, not reviewed by native speakers, labelled on screen.
- **AI coach**: Anthropic's Claude API (`claude-haiku-5-5`). Claude and Anthropic are trademarks of
  Anthropic, PBC. Language Lab is not affiliated with Anthropic or with USCIS.
- **Libraries**: React and React DOM (MIT).
- **formN400.org**: the colours and fonts match formN400.org, the owner's separate earlier site, so
  the two look alike at lab.formn400.org; the style was re-implemented here, and no code, text, data
  or images were copied. Earlier commits contained civics translations imported from the owner's
  separate N400 project; they were removed and are not part of the submission (`NOTICE` item 9).
  lab.formn400.org is only a subdomain used to host this app; formN400.org is a separate, earlier
  project of the same owner, shares no code, data or licence with Language Lab, and its privacy
  policy does not cover Language Lab.
- **Everything else** was written during the hackathon with Kiro, from 2026-11-01.
