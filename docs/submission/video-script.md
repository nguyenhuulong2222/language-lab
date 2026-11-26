# Demo video — script and shot list

Target length **2:40** (limit for this script 2:45; Devpost limit 3:00). The app is recorded on an
iPhone in Safari at <https://language-lab-ade.pages.dev>. The last 30 seconds are a screen recording
of the GitHub repository. Labels in quotes are the exact English text of the app.

Every claim below was checked against the live app and the code on 2026-11-20. Where something depends
on the recording (a speech result, an AI reply, which question is drawn), the shot says what to do if
it does not happen.

## Shot list

| Time | Shot (iPhone unless noted) | On-screen caption |
|---|---|---|
| 0:00–0:15 | A printed list of civics questions on a table (no faces, no real documents), then the phone with the home screen "Welcome to Language Lab" | "Practising for the citizenship interview, alone" |
| 0:15–0:27 | Home: "Choose a language" is at the top. Tap "Tiếng Việt": the interface changes at once and the AI translation notice shows. Tap "English" to switch back. (The phone is set to English, so the app opened in English.) | "10 interface languages, labelled as AI drafts" |
| 0:27–0:50 | Scroll to the AI coach card, "Practice the N-400 interview with an AI coach". Pick "Aurora Thistlewood (fictional)", "Start practice". The notice "Before you turn on the AI coach" opens; pause on it. "Turn on the AI coach". Type a short answer and save; show the tip and the practice follow-up, each marked "AI-generated feedback" | "Optional AI coach: nothing is sent before you agree" |
| 0:50–1:15 | "← Back to Home"; "1. Who is practicing?" stays on "Most people"; "2. What do you want to do?": "Practice test"; profile, filing date, "No, practice without AI". Tap "Play the question" on the first N-400 question; tap "Tap to speak" and answer aloud as the fictional person; show the words that were heard; "Save answer and continue" | "Speak or type. Every answer works by typing too" |
| 1:15–1:30 | Reading: read the sentence aloud with one word changed by its ending (for example "citizens" for "A citizen can vote.", or "elect" for "Who elects the President?"); "Check my reading"; show "This counts." and the note "This still counts." | "Near misses are explained, and they still count" |
| 1:30–1:47 | Civics: answer a question aloud, "Check my answer", show "This counts" and the official answers, then the picture under the answer | "Checked against the USCIS answer key, not by AI" |
| 1:47–1:57 | "← Back to Home", "Study", "2025 civics test"; "Next" twice, "Previous" once | "Study the questions with the official answers" |
| 1:57–2:05 | "← Back to Home"; "1. Who is practicing?" shows four choices; tap "65 or older, green card for 20 years or more (65/20)"; Reading and Writing now say "Not required for 65/20"; "Civics": setup has 65/20 already chosen; "Start practice": "Question 1 of 10", with the interpreter line at the top | "50/20, 55/15 and 65/20: the USCIS exceptions" |
| 2:05–2:13 | A full-interview report: each part with "You reached the practice goal" or "Practice this again", and the disclaimer | "A practice report, never pass or fail" |
| 2:13–2:40 | Screen recording on a computer: the GitHub repository. Show `.kiro/steering/content-safety.md`, then `.kiro/specs/interview-coach/requirements.md` scrolled to "Analyze Requirements", then `.kiro/hooks/`, then `.kiro/agents/` | "Built with Kiro: steering, specs, hooks and custom agents" |

## Narration (about 380 words at a calm pace)

**0:00** Many older immigrants prepare for the citizenship interview alone, with a printed list of
questions. What they need is practice out loud: hear a question, answer it, and know if the answer
counts.

**0:15** Language Lab brings back the language-lab method, listen, speak and compare, on a phone,
in the clean style of formN400.org. It is free and needs no
account. The interface comes in ten languages, each marked as an AI translation. The questions stay in
English, as in the real interview.

**0:27** In the N-400 part there is an optional AI coach. Before anything is sent, a notice explains
what happens: only the text of the answer goes to the AI, and only after you agree. Every practice
uses a made-up person, so you never share real details. The coach gives one tip on your English and a
practice follow-up question. It never scores you.

**0:50** The full interview has the four parts of the real one. You can listen to each question, then
answer by voice, or by typing.

**1:15** For reading, the app compares your words with the sentence. Here I changed the ending of one word.
The app explains the difference, and it still counts.

**1:30** Civics answers are checked against an answer key built from the official USCIS lists. AI
never decides if a civics answer is right. After the answer, a public-domain picture from the
Smithsonian or the Library of Congress helps it stick.

**1:47** Study first lets you go through the questions with the official answers, without a score.

**1:57** USCIS has three age exceptions. People who are 50 with 20 years as permanent residents, or
55 with 15 years, skip the English test and take the usual civics test, in their own language if
they bring an interpreter. At 65 with 20 years, civics uses 10 of the 20 starred questions. The
app quotes the USCIS page.

**2:05** At the end there is a practice report. It never says pass or fail, and it is not legal
advice.

**2:13** We built Language Lab with Kiro. Steering files set the rules first: fictional profiles
only, and AI never scores civics. Each feature started as a spec. The requirements review caught
problems before code, such as earlier answers being sent to the AI. Hooks ran the type check and the
tests on every save and blocked access to secret files. Two custom agents reviewed every change
against USCIS sources, the safety rules and the design system.

**2:35** Language Lab. Practice out loud, at your own pace.

## Fallbacks during recording

- **"Tap to speak" does nothing or Safari has no speech recognition**: type the answer and change the
  caption at 0:50 to "Speak or type". Do not show a fake voice result.
- **The AI coach says "AI feedback is not available right now"**: the coach has reached a limit or the
  service failed. Record again later, or show the notice and the message honestly and say "When the
  coach is available...".
- **The civics question drawn has no picture**: pictures exist for 49 questions only. Keep answering
  ("Next question") until one with a picture comes up, then cut.
- **The reading result does not count**: say the sentence again with only the plural changed.

## Recording checklist

- [ ] iPhone: Settings > Control Center: add "Screen Recording". For the voice shots, long-press the
  record button and turn the microphone **on**, so the narration is recorded. Turn it off for silent
  shots.
- [ ] Focus: turn on **Do Not Disturb** (or a recording focus) so no notification appears; turn off
  "Show Previews".
- [ ] Safari: open only <https://language-lab-ade.pages.dev>; close other tabs; turn off AutoFill for
  names and contacts (Settings > Apps > Safari > AutoFill) so no real data is suggested in a text box.
- [ ] Keyboard: turn off predictive text if it suggests personal words.
- [ ] Use only the fictional profiles: Aurora Thistlewood, Juniper Hale, Rowan Pike. Say and type only
  the fictional person's answers. Never say or type a real name, address, date of birth, phone
  number, A-number or case detail.
- [ ] Show no real documents, mail, faces or screens with personal information. The printed civics
  list must be the public USCIS list.
- [ ] No music, or only music you own or that is licensed for this use; no third-party logos except
  as they appear in the app's own credits.
- [ ] Portrait orientation; normal text size (one short shot at extra-large text is fine); battery and
  status bar clean.
- [ ] Narration: a quiet room; read the script slowly; keep total length at or under 2:45.
- [ ] Upload to YouTube as **Public**, with a title such as "Language Lab: naturalization interview
  practice (Kiroween 2026)". Check that it plays when signed out.
