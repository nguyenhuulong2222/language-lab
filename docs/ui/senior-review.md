# Senior-friendly review (branch ui/senior-friendly)

Audience: learners aged 60–85 with weak eyesight, shaky fingers and little experience with apps, often
on a phone in a quiet room, sometimes with a family member helping. The 1970s language-lab look
stays; clarity wins over style.

## Step 0 — Baseline (2026-11-20, `main` at 26da2db)

- **Review**: the `ui-reviewer` agent, read-only, ran on HomeScreen, IntroScreen, N400Screen,
  EnglishScreen, CivicsScreen, StudyScreen, ReportScreen, PartReportScreen, Header, SettingsPanel,
  AnswerInput and SpeakButton with their CSS, against the checklist in Step 7.
- **Before screenshots**: `layout-check --prod --shots`, en and vi, normal size, 390px. 50 images in
  `$TMPDIR/ll-senior-before` (system temp folder, not in the repository).

Line numbers are those of `main` at 26da2db; "~" marks approximate lines. "Step" is where it is fixed.

| # | File and line | Problem | Step |
|---|---|---|---|
| 1 | `base.css:17-22` | Text sizes are 16/18/20px (100/112.5/125% of 16px), not 18/21/24px | 1 |
| 2 | `tokens.css:46`; `Screen.css:41,48,112`; `Disclaimer.css:4`; `AiNotice.css:16`; `controls.css:~72` | Body line height 1.7; several reading texts at 1.35–1.4 (prompt, lead, card text, inline disclaimer, AI notice, answer box) | 1 |
| 3 | `base.css:52`; `controls.css:~118`; `Screen.css:~172` | `p { margin: 0 }`; spacing in panels is 12px (0.67em), lists 8px | 1 |
| 4 | `tokens.css:49-50` | Line length 68ch, about 38em; the target is 34em at most | 1 |
| 5 | `Screen.css:46-48`; `ReportScreen.css:~56` | The question and sentence text (`.prompt`) and the profile name use Bitter; Bitter should be for headings only | 1 |
| 6 | `Screen.css:18-25,51-54`; `StageStepper.css:11-18`; `ReportScreen.css:~17` | Running text in monospace, uppercase with letter spacing ("TAKE 02", "Question 3 of 10", the stepper count) | 1, 3, 4 |
| 7 | `tokens.css:41` | Captions, notes, badges, footer, disclaimers and the stepper are all at the 16px floor | 1 |
| 8 | `base.css:~56`; `Footer.css:23`; `Screen.css:164` | Teal links are normal-size text at 5.84:1 (light) and 5.89:1 (dark); below 7:1 | 1 |
| 9 | `Screen.css:28` | `.take__number`: teal 16px text, 5.40:1 | 3 (removed) |
| 10 | `controls.css:5-20,36-40` | Button text 18px/600 on teal 5.84:1, on amber 5.10:1 (light); not large text | 1, 2 |
| 11 | `Screen.css:~100-114` | 16px card text on the teal primary card, 5.84:1 | 3 |
| 12 | `StageStepper.css:~93-103` | 16px marker numbers on teal or amber | 4 |
| 13 | `StageStepper.css:~100` | The current step is shown by an amber fill only; amber also means "review" | 4 |
| 14 | `controls.css:97`; `tokens.css:16`; `StageStepper.css:~88` | `--border` edges of choice rows, panels and markers at 1.76:1 (light) and 1.54:1 (dark); control edges need 3:1 | 1, 2 |
| 15 | `tokens.css:74` and every user of `--tap-min` | Tap targets 48px, not 56px | 2 |
| 16 | `Header.css:~41` | Header buttons 8px apart (target 12px), wrapping to several rows | 2, 5 |
| 17 | `controls.css:5-20,45-47` | Primary button 48px, 18px/600, content width, side by side; never full width on a phone | 2 |
| 18 | `AnswerInput.tsx:175,195` | Two primary buttons at once ("Continue and say it" and "Check my answer") | 2 |
| 19 | `Header.tsx:169-180` | Leave confirm: "Yes, go home" is primary and "Stay here" secondary; not full width | 4 |
| 20 | `controls.css:109-112` | Radio and checkbox marks 24px, rows about 48px | 2 |
| 21 | `base.css:66-68`; `tokens.css:76` | Focus ring offset 2px, not 3px | 2 |
| 22 | `Coach.css:41-56` | The coach switch is a 40×22px track in a 48px button | 2 |
| 23 | `controls.css:~61-72` | The answer box can be resized with a small drag handle | 2 |
| 25 | `HomeScreen.tsx:47-51` | Home opens with the heading, lead, English notice and "How it works" before any choice | 3 |
| 26 | `HomeScreen.tsx:67-104` | Order is full, coach, Study first, 65/20, parts; target is full, 65/20, coach, parts, Study first | 3 |
| 27 | `HomeScreen.tsx:67-70` | No "Start here" and no "Start practice" button on the full-interview card | 3 |
| 28 | `HomeScreen.tsx:67-125`; `Screen.css:~80` | About 8 large cards; the parts are a 2-column card grid, not a simple list | 3 |
| 29 | `en.json` `home.title`, `home.lead`; `TakeHeader.tsx:~52` | "Welcome to the booth", "quiet booth", "TAKE 01" | 3, 6 |
| 30 | `HomeScreen.tsx:126-134` | A long disclaimer and two 60–95 word privacy notes on Home | 3, 6 |
| 31 | `HomeScreen.tsx` | No first-visit hint about text size | 5 |
| 32 | `StageStepper.tsx:~48-56`; `en.json` `stepper.count` | "Stage 3 of 5 · N-400 conversation", 16px monospace | 4, 6 |
| 33 | `Screen.css:51-55` | "Question 3 of 10" in 16px monospace | 1, 4 |
| 34 | `SpeakButton.tsx:76-79` | "Play aloud": a secondary 48px button; no "Playing…" text | 4 |
| 35 | `SpeakButton.tsx:80-84` | "Play again" appears as soon as playback starts | 4 |
| 36 | `SpeakButton.tsx:86` | A voice-source note under the play button adds reading before the answer box | 4 |
| 37 | `AnswerInput.tsx:184-202`; `voice.say`, `voice.stop` | Microphone button "Say it" / "Stop listening", secondary, 48px; no "Got it" state | 4 |
| 38 | `AnswerInput.tsx:~133`; `*.yourAnswer` | The answer box label is "Your answer", not "Or type your answer" | 4 |
| 39 | `voice.denied`, `voice.unsupported`, `help.mic` | No steps for allowing the microphone on iPhone Safari or Android Chrome | 4 |
| 40 | `AnswerInput.tsx:169-183` | A 50-word voice notice before the first use of the microphone | 4, 6 |
| 41 | `ScreenHelp.tsx:~44-60` | The help button is "How this works"; 5–6 steps on practice screens; opens by itself the first time and pushes the answer box down | 5 |
| 42 | `CivicsScreen.tsx:~92-98`; `controls.css:~138` | The civics result ("Correct"/"Not yet") is an 18px heading under a 26px question; no short reason | 4 |
| 44 | `PartReportScreen.tsx:~28,~55-60` | The part report opens with a 40-word lead; the result is a 16px badge | 4, 6 |
| 45 | `EnglishScreen.tsx:~224-235` | About 110 words of small print under every reading and writing answer box | 4, 6 |
| 47 | `Header.tsx:~118-124`; `header.settings` | The button says "Settings", not "Text size"; the header scrolls away | 5 |
| 48 | `SettingsPanel.tsx:~26-41` | Text size is three radio rows with 24px marks and no "Aa" preview | 5 |
| 49 | `SettingsPanel.tsx:~43-52` | Slower voice is a checkbox, not an On/Off switch | 5 |
| 50 | `SettingsPanel.tsx:53` | Settings reset on reload (no storage, by rule); the defaults must be the comfortable ones | 1, 5 |
| 51 | `SettingsPanel.css:7` | The "Text size" legend is body size | 5 |
| 52 | `en.json` | Jargon: stage, session, "Practice score reached", "practice passing score", TAKE, booth, build, answer key, authoritative, assisted, unscored, recorded voices, Device voice, Comfort settings | 6 |
| 53 | `en.json` | Long texts and sentences over 20 words; the filing-date choice is hard to read | 6 (legal keys keep their wording) |
| 54 | `en.json` `n400.failed` | "Start over to try again" next to a "Try again" button | 6 |
| 55 | `IntroScreen.tsx:~66-68,~110-122` | Two long notes above the profile choice; the start hint sits below the button | 4, 6 |

Already met at the baseline (reviewer): `--ink` and `--ink-2` pass 7:1 everywhere; no text below 16px;
no hover-only information, swipe, long-press or time limit; no autoplay; status shown with an icon and
a word; one filled primary card on Home; the typing box is always visible; the prominent disclaimer
sits above Next on result screens; the report headline is large. Items 24, 43 and 46 in the review
were passes and are not listed.

## Changed strings

Filled in by Step 6.

## Screens before and after

Filled in by Step 7.
