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

Every English interface string that Steps 3 to 6 added, changed or removed, compared with `main`
(26da2db). Legal keys keep their wording. The only legal change is `voice.consent.text`, where the
quoted button name follows the new microphone button ("Say it" → "Tap to speak") in every locale.
The new legal key `home.special.cta` is English only and reuses the eligibility wording. All other
keys have new AI drafts in all 14 locales, and the review sheets (`docs/locale-review.md` and `docs/locale-review/`) were
regenerated, so every changed key shows up there for the human reviewers.

Plain-word rules used in Step 6: short sentences, everyday words, the button name in quotes when a
text tells you to press it, and errors that say what happened and what to do next. Words removed:
stage, session, booth, build, answer key, authoritative, assisted, unscored, "practice score", device.
Content (civics questions, answers, reading and writing sentences, N-400 questions) is unchanged.

| Key | What | Old | New |
|---|---|---|---|
| `app.stageNotBuilt` | changed | This stage of the practice isn’t built yet. | This part is not ready yet. Go back to Home and choose another part. |
| `stepper.label` | changed | Interview stages | Your steps |
| `stepper.count` | changed | Stage {current} of {total} | Step {current} of {total}: {name} |
| `stage.intro.label` | changed | Welcome | Set up |
| `stage.intro.short` | changed | Intro | Set up |
| `stage.n400_interview.label` | changed | N-400 conversation | N-400 questions |
| `stage.report.label` | changed | Practice report | Your report |
| `badge.onTrack` | changed | Practice score reached | You reached the practice goal |
| `badge.review` | changed | Worth reviewing | Practice this again |
| `report.empty` | changed | Your practice report will appear here once the session is complete. | Your report will show here when you finish the practice. |
| `report.take` | removed | TAKE | (none) |
| `report.title.onTrack` | changed | Practice complete: each part reached the practice score | Well done. Each part reached the practice goal. |
| `report.lead.onTrack` | changed | In this practice, reading, writing and civics each reached the score Language Lab uses. Use the notes below to keep practicing. | Reading, writing and civics each reached the practice goal. Read the notes below and keep practicing. |
| `report.lead.review` | changed | That’s what practice is for. The notes below show where to focus before you try again. | That is what practice is for. The notes below show what to practice next. |
| `report.profile.label` | changed | Practice profile (fictional) | Practice person (made up) |
| `report.generated` | changed | Report generated {datetime} | Report made {datetime} |
| `voice.say` | changed | Say it | Tap to speak |
| `voice.stop` | changed | Stop listening | Listening… tap when you finish |
| `voice.denied` | changed | The microphone is blocked. Allow microphone access in your browser settings, or type your answer. | The microphone is blocked. Follow the steps below to allow it, or type your answer. |
| `audio.play` | changed | Play aloud | Play the question |
| `audio.deviceVoice` | changed | Device voice: the voice installed on your phone or computer. | Built-in voice: the voice of your phone or computer. |
| `intro.profile.legend` | changed | Choose a practice profile | Choose a practice person |
| `intro.profile.help` | changed | Every profile is invented. | Every person here is made up. |
| `intro.startHint` | changed | Make your choice above to start. | Choose one answer in each group above. Then press “Start practice”. |
| `home.locked.title` | changed | In this build you can practice | Right now you can practice |
| `n400.lead` | changed | A calm run through the kind of questions an officer asks about an application. Answer as {name}. Nothing in this step is scored. | An officer may ask questions like these about your form. Answer as {name}. This part gets no score. |
| `coach.feedback.needs_practice` | changed | Worth practicing again | Practice this again |
| `n400.failed` | changed | The next question could not be loaded. Start over to try again. | The next question did not load. Check your internet, then press “Start over”. |
| `voice.consent.text` (legal) | changed | When you press “Say it”, your browser’s speech recognition may send your voice to the browser’s maker, such as Google or Apple, to turn it into words. Language Lab does not send or save your voice. You can type your answer instead. | When you press “Tap to speak”, your browser’s speech recognition may send your voice to the browser’s maker, such as Google or Apple, to turn it into words. Language Lab does not send or save your voice. You can type your answer instead. |
| `voice.consent.continue` | changed | Continue and say it | Continue and speak |
| `writing.show.help` | changed | If you cannot hear the audio, show the sentence and type it. It is checked the same way. Your report marks this attempt as assisted. | If you cannot hear the sound, show the sentence and type it. It is checked the same way. Your report will say the sentence was shown. |
| `writing.shown` | changed | The sentence is shown. Your report marks this attempt as assisted. | The sentence is shown. Your report will say so. |
| `civics.correct` | changed | Correct | This counts |
| `civics.locked.title` | changed | Civics is switched off in this build | Civics is not available right now |
| `voice.needText` | changed | Type or say your answer first, or choose Skip. | The box is empty. Type or say your answer, or press “Skip this one”. |
| `audio.stop` | changed | Stop playing | Stop |
| `home.title` | changed | Welcome to the booth | Welcome to Language Lab |
| `home.lead` | changed | Practice for the naturalization interview in a quiet booth. You answer as a made-up person, so you don't need to share real details. | Practice for your citizenship interview. You answer as a made-up person, so you never share anything about yourself. |
| `home.how.1.text` | changed | Tap Play aloud to hear a question or a sentence. | Tap “Play the question” to hear it. |
| `home.how.3.text` | changed | You see how your answer compares, and what to practice next. | You see if your answer counts, and what to practice next. |
| `home.part.n400.text` | changed | Answer questions about an application. Not scored. | Answer questions about the N-400 form. No score. |
| `home.part.civics.text` | changed | Answer civics questions. Checked against the answer key. | Answer questions about U.S. history and government. Checked with the official answers. |
| `setup.lead` | changed | Choose what this practice needs. Nothing real is asked. | Choose one answer in each group. Nothing here asks about you. |
| `partReport.unscored.text` | changed | These questions could not be scored, so they are not counted as right or wrong. | These questions get no score. They do not count as right or wrong. |
| `partReport.unscored.missing` | changed | A question that is not in the answer key | A question we cannot check |
| `help.button` | changed | How this works | Help |
| `help.listen` | changed | Press “{play}” to hear it. Press the same button again to stop. | Press “{play}” to hear it. |
| `help.sample` | removed | Read the sample answer, or play it. It belongs to the made-up person. It is only an example. | (none) |
| `help.read` | changed | Read the sentence on the screen out loud. | Read the sentence out loud. |
| `help.mic` | changed | Press “{say}” and speak. If your phone asks to use the microphone, press Allow. Press “{stop}” when you finish. | Press “{say}” and talk. Or type in the box. |
| `help.type` | removed | You can always type instead. Tap the box and type. Typing always works. | (none) |
| `help.typeOnly` | changed | Tap the box and type what you hear. | Type what you hear in the box. |
| `help.send` | removed | Check the words in the box. You can change them. Then press “{send}”. | (none) |
| `help.skip` | removed | Press “{skip}” if you do not know. It sends an empty answer and moves on. It counts as not yet. | (none) |
| `help.notScored` | removed | Nothing in this part is scored. | (none) |
| `help.result.reading` | removed | Then you see which words matched. | (none) |
| `help.result.civics` | removed | Then you see Correct or Not yet, and the official answers. | (none) |
| `header.settings` | changed | Settings | Text size |
| `settings.title` | changed | Comfort settings | Text size and voice |
| `settings.slow.label` | changed | Play recorded voices more slowly | Slower voice |
| `header.homeConfirm.yes` | changed | Yes, go home | Leave |
| `header.homeConfirm.no` | changed | Stay here | Keep practicing |
| `partReport.badge.good` | changed | This part reached the practice score | You reached the practice goal |
| `partReport.assisted` | changed | The sentence was shown on screen (assisted attempt). | The sentence was shown on the screen. |
| `aiNotice.text` | changed | This translation was made by AI and may contain mistakes. The English version is the authoritative one. | This translation was made by AI and may have mistakes. If something is unclear, the English version is correct. |
| `aiNotice.legalEnglish` | changed | Disclaimers and legal text are shown in English only until a person has reviewed the translation. | Legal notices stay in English until a person checks the translation. |
| `selfReview.unsupported` | changed | This browser cannot record your voice. You can still check your reading with “Say it” or by typing. | This browser cannot record your voice. You can still press “Tap to speak” or type. |
| `selfReview.denied` | changed | The microphone is blocked. Allow microphone access in your browser settings. | The microphone is blocked, so recording cannot start. Allow the microphone for this site in your browser settings, then try again. |
| `compare.honest.heard` | changed | This result is based on the words your device heard. If it heard you wrong, try again or type your answer. | This result uses the words your phone or computer heard. If it heard you wrong, try again or type your answer. |
| `report.line.civics.unscored` | changed | Not scored, because the answer changes or is not in the answer key: {names}. These questions do not count as correct or incorrect. | No score for these, because the answer changes over time or we cannot check it: {names}. They do not count as right or wrong. |
| `report.line.writing.assisted` | changed | Writing attempts made with the sentence shown on screen (assisted): {assisted} of {presented}. | Sentences written while the sentence was shown: {assisted} of {presented}. |
| `civics.heard.closest` | changed | Your device gave several guesses of what you said. The one closest to an answer in the answer key is shown. | Your phone or computer heard a few possible answers. We show the one closest to an official answer. |
| `home.start.label` | added | (none) | Start here |
| `home.full.start` | added | (none) | Start practice |
| `home.special.cta` (legal) | added | (none) | 65 or older, 20 years with a green card? Start the 65/20 practice. |
| `home.textSizeHint` | added | (none) | Text too small? Tap Text size at the top. |
| `audio.playing` | added | (none) | Playing… |
| `audio.playSentence` | added | (none) | Play the sentence |
| `voice.gotIt` | added | (none) | Got it. Tap to speak again |
| `voice.orType` | added | (none) | Or type your answer |
| `voice.micHelp.title` | added | (none) | How to allow the microphone |
| `voice.micHelp.iphone` | added | (none) | iPhone (Safari): tap “aA” next to the web address, then Website Settings, then Microphone, and choose Allow. Then reload the page. |
| `voice.micHelp.android` | added | (none) | Android (Chrome): tap the small icon to the left of the web address, then Permissions, and turn on Microphone. Then reload the page. |
| `voice.micHelp.typing` | added | (none) | You can always type your answer in the box instead. |
| `civics.why.correct` | added | (none) | Your answer matches an official answer. |
| `civics.why.notYet` | added | (none) | Your answer does not match the official answers yet. |
| `settings.slow.on` | added | (none) | On |
| `settings.slow.off` | added | (none) | Off |
| `help.done.n400` | added | (none) | Press “{send}” to go on. Nothing here gets a score. |
| `help.done.english` | added | (none) | Press “{send}”. Then you see if it counts. |
| `help.done.civics` | added | (none) | Press “{send}”. Then you see if it counts, and the official answers. |
| `settings.textSize.sample` | added | (none) | Aa |

## Screens before and after

Screenshots of the production build at 390px, normal text size, in English and Vietnamese: 50
before (`main`, Step 0) and 50 after (Step 7), kept in the system temp folder (`ll-senior-before`,
`ll-senior-after`), not in the repository.

| Screen | Before | After |
|---|---|---|
| Every screen (header) | 16px buttons: Language, Home, "Settings", About; root text 16px | 56px buttons with 12px gaps: Language, Home, "Text size", About; root text 18px (21 and 24px at large and extra large) |
| Stepper | Monospace "Stage 5 of 6 · Civics", 16px | "Step 5 of 6: Civics" at 20px, semibold, wraps at 320px; current marker teal with an ink ring |
| Home | "Welcome to the booth"; English notice and How it works above the choices; the full interview is a filled card; 65/20 below Study first | "Welcome to Language Lab", a two-sentence lead, the hint "Text too small? Tap Text size at the top.", then the "Start here" card with one primary "Start practice", the 65/20 card, the AI coach card, "Practice one part" as a list, "Study first"; How it works and the notices at the bottom |
| Text size panel | "Comfort settings": three small radio rows and a checkbox "Play recorded voices more slowly" | "Text size and voice": three large "Aa" tiles (Normal, Large, Extra large) and a 64px "Slower voice" On/Off switch |
| Setup | "Choose a practice profile", overline TAKE 01, start hint "Make your choice above to start." | "Choose a practice person", "Choose one answer in each group above. Then press “Start practice”." |
| N-400 question | TAKE 02 overline; "Play aloud" (48px); six help steps open; "Say it" next to the submit button under the box | No overline; 64px "Play the question" and "Play again" side by side, "Playing…" while it plays; three help steps; 64px "Tap to speak" above the box; the box labelled "Or type your answer"; one full-width primary "Save answer and continue" |
| Reading question | Six help steps; "Say it" beside "Check my reading" | Three help steps; "Tap to speak" first, then the box; primary "Check my reading", secondary "Skip this one" |
| Writing question | "Play aloud" | "Play the sentence" (64px) and "Play again"; three help steps; "Show the sentence" explained without "assisted" |
| Civics question | Bitter question text; "Play aloud" 48px; six help steps | Question in the body font, semibold; the same 64px player; three help steps; microphone and box as above |
| Microphone blocked | One sentence: allow access in the browser settings | The sentence plus "How to allow the microphone" with steps for iPhone Safari and Android Chrome, and "You can always type your answer in the box instead." |
| Reading and writing result | "This counts." / "Not yet." at 18px inside the panel, a short disclaimer inside the panel as well as the prominent one | A 34px headline with icon, the reason lines at 22px, then the details, the prominent disclaimer, one primary Next |
| Civics result | "Correct" / "Not yet" at 18px | 34px "This counts" / "Not yet" with icon, one reason line ("Your answer matches an official answer."), the official answers, the prominent disclaimer, primary "Next question" |
| Part report | A small pill badge "This part reached the practice score" / "Worth reviewing" | A 34px headline "You reached the practice goal" / "Practice this again" with icon, then the count as the reason |
| Full report | "TAKE 06 · PRACTICE REPORT" overline; "Practice complete: each part reached the practice score"; badges "Practice score reached" / "Worth reviewing" | No overline; "Well done. Each part reached the practice goal."; "You reached the practice goal" / "Practice this again"; prose limited to 34em |
| Study first | Next disabled on the last question, with Home as a secondary button | On the last question "Back to home" is the primary button |
| Leave confirmation | "Yes, go home" (primary) and "Stay here", side by side | Full-width "Keep practicing" (primary) and "Leave" (secondary), stacked |
| Coach choice, Study test choice | Option cards | Unchanged: two equal option cards and no filled button, so the screen does not push one answer |

## Step 7 checks

- Layout check, production build with the CSP of `public/_headers`, MIN_TARGET 56: all 10 production
  languages at normal size and 390px; English and Vietnamese at large and extra large, at 390px and
  320px. 18 runs, 25 screens each, all pass, no CSP violation.
- New layout checks: no rendered text below 16px; every primary button at least 64px high at phone
  width; exactly one `.btn--primary` per screen state (a screen with two or more option cards and no
  primary is allowed: the coach yes/no and the 2008/2025 choice).
- New unit test `src/ui/__tests__/contrast.test.ts` reads `tokens.css`: text pairs (ink, ink-2 and
  teal on every background, on-accent on teal) 7:1 or more; amber and on-accent on amber 4.5:1 or
  more; borders 3:1 or more; light and dark (both dark blocks equal).
- Second ui-reviewer pass. Fixed: part report headline and reason; the duplicate short disclaimer in
  the sentence feedback panel; Study first last question; report line length; result headline size.
  Not changed, with reasons:
  - Sticky header: with 56px buttons the header is two rows on a phone (four at 320px and extra
    large); keeping it on screen would cover a third of the page. The "Text size" button is at the top
    of every screen.
  - Long notes on answer and result screens (`compare.setting`, `compare.setting.writing`,
    `compare.vocab`, `partReport.scope`, the consent text): legal keys. They stay visible and keep
    their wording.
  - Jargon in `intro.locked`, `civics.locked.text`, `study.locked`, `civics.stopped.correct`,
    `intro.special.help`: legal keys, unchanged. The locked texts only show in a build without
    reviewed answer keys, never in production.
  - Help opens by itself on the first visit to a screen: kept, now three short steps; it stays in
    the page (no pop-up) and closes with the same "Help" button.
  - "AI-generated voice" note under the player: a disclosure that the voice is AI-made, kept.
  - Two primary buttons while the leave confirmation is open: the brief asks for "Keep practicing"
    as primary; the panel is a separate state above the screen.
