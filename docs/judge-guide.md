# Judge guide: Language Lab in 3 minutes

Live: <https://language-lab-ade.pages.dev> (the production build; features of a branch appear there
only after that branch is merged and deployed)

Language Lab is a free practice booth for the U.S. naturalization interview. Everyone practises as an
invented person, so nobody types or says real details. It is an independent study aid. It is not
affiliated with USCIS or any government agency, it is not legal advice, and practice results predict
nothing.

## What needs a microphone, and what works by typing

- **Everything works by typing**: every answer box accepts typed text, and every screen can be
  finished without a microphone.
- **"Tap to speak"** (answer by voice) uses the browser's speech recognition. It needs a microphone and a
  browser that supports it, such as Chrome, Edge or Safari. The browser asks for permission first.
- **"Record and compare"** on the reading screen records you on your device and plays it back. It needs
  a microphone. The recording stays on the device.
- **"Play the question"** ("Play the sentence" in writing) plays a recorded voice clip (or the device voice). It needs sound, not a microphone.

## The path (about 3 minutes)

1. **Home (15 s)**: the app opens in your phone's language; English if it is not offered. At the
   top is "Choose a language" with every language under its own name. Then the welcome and two
   steps: "1. Who is practicing?" (Most people, chosen by default, or 65 or older with a green card
   for 20 years or more) and "2. What do you want to do?" (Study, or the filled "Practice test").
   Below: "Or practice one part" and the AI coach card. Every card has a verb and an arrow. "How it
   works" and the disclaimer are at the bottom; "About & disclaimer" is in the footer. Every other
   screen starts with "← Back to Home", and the browser Back button goes to Home too (in a practice
   it asks first: "Keep practicing" or "Leave").
2. **AI coach (40 s)**: choose "Practice the N-400 interview with an AI coach". Pick a fictional
   profile and press "Start practice". The consent notice opens first, and nothing is sent until you
   press "Turn on the AI coach". Turn it on and type one answer: the coach gives a feedback label, one
   English tip and a practice follow-up question, each marked "AI-generated feedback". If the coach is
   switched off on the live site, the screen says "AI feedback is not available right now" and the
   practice goes on. Without AI: press "Cancel", then "No, practice without AI".
3. **Full interview (60 s)**: press "← Back to Home". Under "2. What do you want to do?" press
   "Practice test", pick a profile, and
   choose when the N-400 was filed (this picks the 2008 or 2025 civics test). Choose "No, practice
   without AI". Type short answers to the N-400 questions. In reading, type the sentence shown. In
   writing, press "Show the sentence" if you cannot listen, then type it. In civics, type answers. The
   practice test stops on the official stop rule.
4. **Report (20 s)**: each part shows "You reached the practice goal" or "Practice this again" (never pass or
   fail), the items to practise, and the disclaimer.
5. **Study (15 s)**: from Home, under "2. What do you want to do?" choose "Study" and a test
   version. Page through the questions with "Previous" and "Next", with the official answers and
   pictures. Nothing is scored. "← Back to Home" is at the top.
6. **65/20 (15 s)**: on Home, under "1. Who is practicing?" choose "65 or older, with a green card
   for 20 years or more". "Study" now opens with only the starred questions, and Reading and Writing
   say "Not required for 65/20". Choose "Civics" under "Or practice one part". The setup has the choice "I am 65 or
   older and have been a permanent resident for 20 years or more" already ticked. The civics part asks
   10 of the 20 questions marked with a star in the official list, and the practice score is 6 correct
   answers (USCIS Policy Manual, Vol. 12, Part E, Ch. 2). A line links the USCIS page that says a 65/20
   applicant may take the real test in their own language with an interpreter. The questions stay
   English.
7. **Language (15 s)**: in "Choose a language" at the top of Home choose, for example, Tiếng
   Việt (on other screens the globe button in the header opens the same list). The interface changes
   at once and says the translation was made by AI, may contain
   mistakes, and that the English version is correct.
   Disclaimers, legal lines and every civics question stay in English. "Text size" in the header has three
   sizes (normal, large and extra large) and a "Slower voice" On/Off switch. Every practice screen
   has a "Help" button with three short steps.

## The AI coach and consent

The AI coach is optional and off by default, and it is off again in every new practice. Only after you
confirm the notice is the text of each N-400 answer sent to Anthropic's API, through the site's own
server. Audio and earlier answers are never sent. Before sending, the app refuses text that looks like an
A-number, a Social Security number, a phone number, an e-mail address or a full date. The coach never
scores civics, reading or writing.
