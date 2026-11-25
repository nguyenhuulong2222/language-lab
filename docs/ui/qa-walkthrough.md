# QA walkthrough: two personas (branch ui/senior-friendly)

Owner feedback (iPhone, Vietnamese): "The UI is still messy and I am not happy with Home. It is not
clear where an older person taps, where a younger person taps, or how to get back after tapping into
a section."

## Q0 — Baseline walkthrough (before, at 5a5742f)

**Method.** The production build, served with the CSP of `public/_headers`, in headless Chrome at
390×844 (phone, 2× pixels), started with the persona's language (`--lang`, so the app opens in it).
A driver script (kept outside the repository, `~/ll-senior/walk.mjs`) walks each path. On every
screen it records the heading, every visible control and its position, whether a way back to Home is
visible and where, the filled primary buttons, English UI lines inside the non-English page (every
non-legal key whose translation differs from English), and the history length. It saves a full-page
and a first-viewport screenshot (`$TMPDIR/ll-walk-before-A`, `-B`). The browser Back button was
pressed on a Study screen, on a practice question and on a report. Toggles on the way (Text size,
About, Help, Play, Play again, the coach switch, the leave confirmation) were opened and closed;
navigation buttons were followed along the paths below. The ui-reviewer agent reviewed HomeScreen,
Header, AiNotice, StudyScreen and the part screens with this brief.

**Persona A.** 72, 65/20, Vietnamese, extra-large text. Wants to study first, then try the civics
test. Path: Home → Text size: Rất lớn → Học trước (Study first) → tick the 65/20 filter → 2025 test
→ question 1 → Next to the last question → browser Back → reopen → the 65/20 card → setup (65/20
ticked) → Bắt đầu luyện tập → civics questions to the end → report → browser Back.

**Persona B.** 35, Spanish, normal text. Wants the full practice interview, then the AI coach.
Path: Home → Empezar la práctica → setup → No, practicar sin IA → N-400 (7 answers) → reading →
writing → civics → browser Back → reopen and finish → report → Practicar de nuevo → the AI coach
card → setup → notice → Activar el entrenador de IA → one answer → header Inicio (leave confirmation).

### What the walkthrough found

Positions are page offsets in CSS px; the viewport is 844px high.

| # | Area | Found | Persona / screen | Step |
|---|---|---|---|---|
| QA-01 | Way back | Browser Back leaves the app from every screen: the app never adds a history entry (`history.length` stays 2 on all 25 audited screens). Back from Study, from a civics question and from a report went to `about:blank`, and the practice was lost | A, B: all | Q1 |
| QA-02 | Way back | No "Back to Home" in the page. The only way back is a header button ("Trang chủ" / "Inicio") among three or four header buttons. In a practice it opens a confirm panel; nothing near the content says how to leave | A, B: setup, N-400, reading, writing, civics, coach | Q1 |
| QA-03 | Way back | One action, two labels: header "Trang chủ" / "Inicio" (`header.home`) and in-page "Về trang chủ" / "Volver al inicio" (`report.home`) | A, B: Study, reports | Q1 |
| QA-04 | Way back | Study: "Về trang chủ" sits at the bottom, after the question, the picture and the answers (y = 4066 on question 1 at extra-large). On the last question it becomes the filled primary button; on the version picker it is the last control | A: study-choose, study-question, study-last | Q1 |
| QA-05 | Way back | Study: "Câu hỏi trước" / "Câu hỏi tiếp theo" are in a four-button row with "Chọn bài kiểm tra khác" and Home; Previous is disabled on question 1 | A: study-question | Q1 |
| QA-06 | Way back | With the leave confirmation open there are two filled buttons ("Seguir practicando" and the screen's own "Continuar") | B: leave-confirm | Q1 |
| QA-07 | Header | The header is three rows on a phone: the logo alone, then the language and Text size, then About (Spanish normal: buttons at y = 59 and 128; Vietnamese extra-large: 78 and 171, with "Trang chủ" a fourth button in a practice) | A, B: every screen | Q2 |
| QA-08 | Header | The About button is a phrase that wraps to two lines in Vietnamese ("Giới thiệu & miễn trừ trách nhiệm") | A: every screen | Q2 |
| QA-09 | Notice | The AI-translation notice is three paragraphs. At Vietnamese extra-large the header and the notice fill the whole first viewport on every screen: no heading, question or button is visible before scrolling | A: every screen | Q2 |
| QA-10 | Notice | The notice has a thick amber left border, the colour the app uses for "review this", so it reads as a warning | A, B | Q2 |
| QA-11 | Home | Language grid: the selected button stacks the check under the name, so its row is taller than the others | A, B: home | Q3 |
| QA-12 | Home | Only "Start here" has a button. The 65/20 card, the AI coach card, the part rows and Study first have a border but no arrow and no verb; they look like text panels | A, B: home | Q3 |
| QA-13 | Language | The 65/20 card title and text are English inside the Vietnamese and Spanish pages ("65 or older, 20 years with a green card? Start the 65/20 practice."): both are legal keys | A, B: home | Q3 |
| QA-14 | Home | Study first is a row in the practice list, between the parts and How it works, styled like a practice part | A: home | Q3 |
| QA-15 | Home | No first question for "who is practising": a 65/20 learner must find the 65/20 card (y = 2652 at extra-large) among practice cards; "Bắt đầu luyện tập" is at y = 2471, three screens down | A: home | Q3 |
| QA-16 | Consistency | Four patterns for "tap to go somewhere": the Start here panel with a button, option cards (65/20, coach), row buttons (parts, Study), and plain buttons; frames of 2px and 3px | A, B: home, Study | Q3, Q4 |
| QA-17 | Home | The N-400 row (with an "AI" badge) and the AI coach card both open the N-400 part; the difference is not explained on the row | B: home | Q3 |
| QA-18 | Language | Setup: the 65/20 checkbox label is a legal key, so it is English in the Vietnamese page ("I am 65 or older and have been a permanent resident for 20 years or more") | A: setup-65-20 | Q3 (explained) |
| QA-19 | Language | Scan result: no untranslated non-legal UI key on any screen in Vietnamese or Spanish. The only English UI text found is the "English" endonym in the grid and the required English line of the AI notice | A, B: all | Q4 (test) |
| QA-20 | Consistency | Sizes not from the spacing tokens: `Header.css` min-height 3.75rem; `Screen.css` 1.25rem and 1.5rem indents, `minmax(min(100%, 14rem), 1fr)`; `LanguageMenu.css` `minmax(11rem, 1fr)`; icon sizes in rem in several files | — | Q4 |
| QA-21 | Consistency | Practice screens put the header, the notice, the stepper, the heading, the lead, the question, Play, Help, the microphone and the box in the same order, but with no way back and the stepper below the notice | A, B: practice | Q1, Q4 |
| QA-22 | Home | The coach choice screen has two equal option cards and no filled button (by design: it must not push the AI). Kept | B: coach-choice | — |
| QA-23 | Coach | Locally there is no coach server: after the first answer the coach switch stays on, the practice continues with "Continuar". The real coach reply was not tested here | B: coach-after-answer | — |

From the ui-reviewer (confirmed in the code, added to the list):

| # | Found | Step |
|---|---|---|
| QA-24 | `PracticeApp.tsx`: no `pushState`, `popstate` or `hashchange`; Study and every part are the same URL (same as QA-01) | Q1 |
| QA-25 | `IntroScreen`, `N400Screen`, `EnglishScreen`, `CivicsScreen` have no in-page way home (same as QA-02) | Q1 |
| QA-26 | Leaving Study counts as a restart; with history, Back from Study must not ask the "answers will be lost" question | Q1 |
| QA-27 | The AI notice sits between the header and the stepper on every screen, pushing the heading below the fold (with QA-09) | Q2 |
| QA-28 | The text-size hint says "at the top", but the Text size button can be off screen behind the notice | Q2 |
| QA-29 | Study's version picker uses option cards; Home uses row buttons for the same kind of choice | Q4 |
| QA-30 | Frames of 1px (header buttons, language buttons), 2px (buttons, cards) and 3px (Start here, special and coach cards, the selected language) for tappable things | Q4 |

## Q5 — Walkthrough again (after, at Q4 plus the review fixes)

Same method and driver, same two personas, on the new Home path. Screenshots in
`$TMPDIR/ll-walk-after-A` and `-B`.

**Persona A now taps** (Vietnamese, extra-large): "1. Ai đang luyện tập?" → "Từ 65 tuổi trở lên, có
thẻ xanh từ 20 năm" → "Học, Mở" (Study opens with the 65/20 starred filter already ticked) → "Bài thi
kiến thức công dân 2025" → "Câu hỏi tiếp theo" to the last question → the last screen's "Về trang chủ"
or the browser Back (both return to Home; Back stayed in the app) → "Kiến thức công dân, Bắt đầu"
under "Hoặc luyện từng phần" (setup has 65/20 ticked; she only picks the filing date) → "Bắt đầu luyện
tập" → 10 questions → report → Back returns to Home.

**Persona B now taps** (Spanish, normal): "2. ¿Qué quiere hacer?" → "Examen de práctica, Empezar"
(the one filled card) → profile, filing date → "No, practicar sin IA" → N-400, reading, writing,
civics (browser Back on a civics question asks "Seguir practicando / Salir" and stays) → report →
"← Volver al inicio" → the AI coach card "…, Empezar" → profile → the notice → "Activar el
entrenador de IA" → one answer → "← Volver al inicio" asks first → "Salir" → Home.

Recorded on every non-Home screen of both walks: "Back to Home" visible in the first viewport (true
on all 24 screens), exactly one filled button (on the leave question too), no English interface line
outside lang="en", and browser Back stays in the app (history grows by one entry per section).

### Every Q0 item

| # | Status | How |
|---|---|---|
| QA-01 | Closed | `section-history.ts`: one history entry per section; Back from Study, a civics question and a report returned to Home in both walks; tests for popstate from Study, a practice and a report |
| QA-02 | Closed | "← Back to Home" at the top of every non-Home screen (`BackToHome`), asks first in a practice; the layout check fails a screen without it in the first viewport |
| QA-03 | Closed | One label, `report.home` ("Về trang chủ" / "Volver al inicio"); `header.home` removed |
| QA-04 | Closed | Study has Back to Home at the top on every screen and as the primary after the last question; the version picker's bottom Home button is gone |
| QA-05 | Closed | "Previous" and "Next" side by side, 56px (`btn-pair`); "Previous" shows from question 2. The counter reads "Câu hỏi 3/100" / "Question 3 of 100" |
| QA-06 | Closed | While the leave question is open the screen (and the stepper) is hidden: one filled button |
| QA-07 | Closed | Header one row at normal size in all 10 production languages (layout rule); the logo stays on the first row at large and extra large |
| QA-08 | Closed | About & disclaimer moved to the footer as a full-width button |
| QA-09 | Closed | Compact notice: one line in the chosen language, the English line under it at 16px, the rest behind "More"; Back to Home is in the first viewport at Vietnamese extra-large 320px |
| QA-10 | Closed | Thin rules above and below, info icon, no amber |
| QA-11 | Closed | Every button in a row the same height; the check sits in the corner beside the name; the same 2px frame on every button |
| QA-12 | Closed | Every tappable card is an `ActionCard`: frame, visible verb, arrow, hover and pressed states; the verb is part of the button's name |
| QA-13 | Closed | The 65/20 title and line are normal keys with drafts in 14 locales; `home.special.cta` removed (decisions-log) |
| QA-14 | Closed | Study is under "2. What do you want to do?", next to "Practice test", apart from the single parts |
| QA-15 | Closed | "1. Who is practicing?" comes first; the choice feeds Study, Practice test and Civics |
| QA-16 | Closed | One card component for Home, Study's test choice and the coach choice; the old option-card, row-button and start-here styles are removed |
| QA-17 | Explained | The N-400 row (with the "AI" badge: the coach is optional there) and the coach card both open the N-400 part; the coach card opens the consent notice at once. Kept as two entries, since the brief lists both |
| QA-18 | Explained | `intro.special.label` stays a legal key: it states the USCIS eligibility rule. It shows in English until a person reviews Vietnamese; the Home choice the learner taps is translated |
| QA-19 | Closed | New test renders 19 screens in Vietnamese and fails on any English non-legal interface line outside lang="en" |
| QA-20 | Closed | Spacing uses only tokens; left: the 0.75em paragraph rule (a brief requirement in em), the visually-hidden `-1px`, and the stepper's geometry calc. Widths in `minmax()` are layout widths, not spacing |
| QA-21 | Closed | Practice screens: Back to Home → step line → heading → question → Play → answer → one primary; Listen and compare moved after the answer |
| QA-22 | Kept | The coach choice has two equal cards and no fill, by design |
| QA-23 | Explained | No coach server locally: the coach reply was not exercised; the switch, the notice and the "not available" path were |
| QA-24 | Closed | As QA-01 |
| QA-25 | Closed | As QA-02 |
| QA-26 | Closed | Back from Study, setup and reports goes home without the question |
| QA-27 | Closed | The notice is compact (QA-09) and the stepper sits under Back to Home, so the heading is near the top |
| QA-28 | Closed | The header is one row, so "Text size" is visible at the top |
| QA-29 | Closed | As QA-16 |
| QA-30 | Closed | Tappable cards and language buttons use 2px frames; the selected state adds an inner ring and a check |

From the second ui-reviewer pass (all fixed unless explained): the "More" control now has a frame
and an arrow that turns when open; the verb is in each card's name (label in name); duplicate
`.who-card` and `.home__hint` rules merged (the hint is back at body size); the "Who" group uses a
`<legend>`; the duplicate group label on Home is removed (`home.choose` deleted); the stepper is
hidden while the leave question is open. Explained: the reviewer's concern that repeated Back
presses on the leave question grow the history: each Back removes the entry and the app adds one,
so the depth stays the same (the leave test checks the entry is back).

**Not met as written.** "At 390×844 normal size the language grid, the welcome and both Who cards
fit." Measured on the production build: in English the welcome title is at 559px and "1. Who is
practicing?" starts at 797px, inside the first viewport, but the second card ends at 1162px. In
Vietnamese (with the AI notice) "Who" starts at 1066px. The grid is ten 56px buttons in three columns
plus its heading and the in-review line (about 410px); it cannot shrink further without going below
the 56px target or dropping a required element.
