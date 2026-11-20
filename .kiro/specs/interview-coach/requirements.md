# Interview coach — Requirements

Status: revision 2. Revision 1 was analysed ("Analyze Requirements", at the end); its findings are
settled in this text or listed there as open.

## Context confirmed from the code, the docs and the owner's brief

- `src/engine/n400-coach.ts`: `N400Coach` has `nextQuestion(context)` and `feedback(context, answer)`;
  the only implementation is `createScriptedN400Coach`, which gives no feedback.
- `src/contracts/session.ts`: `N400Feedback = { feedback: "understood" | "needs_practice" | "unclear" }`.
  The report never scores N-400 (`report.n400Note`).
- `src/ui/screens/N400Screen.tsx`: an answer is recorded with `onAnswer` and the next question
  loads at once; there is no feedback step today.
- `public/_headers`: `connect-src 'self'`. Cloudflare Pages does not apply `_headers` to responses
  from Pages Functions (developers.cloudflare.com/pages/configuration/headers, read 2026-11-20).
- Pages Functions bindings (developers.cloudflare.com/pages/functions/bindings and
  /wrangler-configuration, read 2026-11-20): KV, Durable Objects (bound from a separate Worker),
  R2, D1, Vectorize, Workers AI, Service bindings, Queues, Hyperdrive, Analytics Engine,
  environment variables, secrets. The Workers rate-limiting binding (`ratelimits`) is not listed
  for Pages, and is per location and approximate in any case.
- D1 on Workers Free: 5 million rows read and 100,000 rows written per day, reset at 00:00 UTC;
  10 databases (developers.cloudflare.com/d1/platform/pricing, read 2026-11-20).
- Anthropic (platform.claude.com/docs, read 2026-11-20): current API version `2026-10-21`; in it
  `temperature`, `top_p` and `top_k` are removed and sending any of them is a 400 error. Structured
  outputs: `output_config.format = { type: "json_schema", schema }`; no `minLength` or `maxLength`;
  `additionalProperties: false` required; replies with `stop_reason` `refusal` or `max_tokens` may not
  match the schema. Cheapest current model: `claude-haiku-5-5`, $0.10 / MTok input and $0.50 / MTok
  output for prompts up to 100,000 tokens; effort `low` with `thinking: {"type": "disabled"}` is
  allowed. These facts are dated in the config (`checkedOn`) and must be checked again before a
  model or API version change.

## Requirements

### REQ-C01 — Optional coach behind the existing interface
The AI coach MUST implement `N400Coach`. The scripted coach stays the default; the screen uses the
AI coach only while the learner has turned it on. `nextQuestion` always comes from the scripted
questions. The AI's extra lines (follow-up question, tip) come through an optional engine method
`turnFeedback`; its result type is engine-local (`src/engine/coach/`), so `src/contracts/` is not
changed (recorded in `docs/decisions-log.md`). Only the current turn is sent: the AI coach ignores
`context.answered`.

### REQ-C02 — Same-origin server, thin handler
The endpoint MUST be a Cloudflare Pages Function at `functions/api/coach.ts`, served from the app's
origin, so `connect-src 'self'` stays. The handler is thin: config parsing, validation, screening,
the prompt, the reply check and the counter logic are pure modules in `src/engine/coach/`, tested
there. The Function MUST set its own headers (`_headers` does not reach it): `Content-Type:
application/json; charset=utf-8`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`.

### REQ-C03 — Secret and keys
The Anthropic key MUST come only from the secret binding `ANTHROPIC_API_KEY`. No key file, dotenv
file or Wrangler dev-vars file is read, printed or written by code, tests, tools or the agent. The
key is sent only in the `x-api-key` header to `https://api.anthropic.com/v1/messages`; it is never
logged or returned. Without the secret the endpoint answers "coach unavailable".

### REQ-C04 — One config file
Model id, `max_tokens`, effort, thinking mode, API version, prices per million tokens with the date
they were checked, and every limit of REQ-C10, MUST live in `data/coach-config.json`, validated by
a pure parser with tests. `temperature` is in the file but MUST be `null`: API version `2026-10-21`
rejects it. The parser fails on anything else.

### REQ-C05 — What the coach returns
For one turn (fictional profile name, scripted question, the profile's sample answer, the learner's
answer) the coach returns: (a) `followUp`: one short follow-up question an officer might ask next,
on the same topic as the scripted question, plain English, ending in "?"; (b) `feedback`
(`N400Feedback`): `understood` means the answer is clear English that answers the question asked,
`needs_practice` means it answers but the English needs work, `unclear` means it is hard to
understand or does not answer the question. It judges clarity and English only, never whether the
content is true, complete or what a real applicant should say; (c) `tip`: one short tip about the
English used (grammar, word choice, speaking in full sentences). Neither `tip` nor `followUp`
contains a rewritten or example answer. The UI shows (a) and (c) with an "AI-generated feedback"
label; (a) is for practice only and is not answered, recorded or sent.

### REQ-C06 — What the coach never does
The coach MUST NOT: score civics, reading or writing; say whether a real application would be
approved or how an interview will go; suggest what to claim, say or write on a real form; give
legal advice; name real officeholders; ask for or repeat real personal details; reply in a language
other than English. The system prompt says so, and REQ-C09 checks the reply.

### REQ-C07 — Consent
The coach is off by default and off again in every new session (React state only, nothing stored).
Turning it on shows a notice before anything is sent: answers typed or spoken in this part are sent
as text to Anthropic through Language Lab's server to produce feedback; answer as the fictional
person; do not say real names, addresses, dates of birth, A-numbers or case details; the screen
cannot catch every personal detail. The learner confirms ("Turn on the AI coach") or cancels. The
switch can be turned off at any time. No network call is made for the coach before the learner
confirms. Only the transcript text of the current turn is sent, never audio, never earlier turns.

### REQ-C08 — Learner text screening
Before sending, the client and the server MUST screen the answer, and refuse it with the kind that
was found, for:
- `a-number`: "A" or "A-" followed by 7 to 9 digits; or a run of 9 digits written with or without
  spaces or dashes;
- `ssn`: 3-2-4 digits separated by dashes, dots or spaces;
- `phone`: 10 digits (optionally with a leading 1 or +1) in the usual groupings (3-3-4 with spaces,
  dashes, dots or parentheses), or 10 or 11 digits in a row;
- `email`: something@something.tld;
- `date-of-birth`: a full date with day, month and year (01/02/1990, 1-2-1990, 1990-01-02).
Years alone, counts ("seven years") and short numbers pass. Digits said as words ("two zero zero")
are out of scope. Tests list positive and negative strings for each kind. When text is refused,
nothing is sent and the learner is told which kind was found; the scripted coach continues.

### REQ-C09 — Reply validation
The server MUST parse the model reply as JSON and accept it only if:
- it has exactly the keys `followUp`, `feedback`, `tip`;
- `feedback` is one of the three values (compared without case, stored lowercase);
- each string is non-empty and within the config's character limit;
- `followUp` is a single question ending in "?";
- every string is English: only Latin letters, digits, spaces and common punctuation;
- no string contains a URL, an e-mail, anything the identifier screen flags, a name from the
  officeholder deny-list, a title followed by a capitalised name ("President X", "Senator X",
  "Governor X", "Justice X", "Judge X", "Secretary X", "Speaker X", "Representative X"), or a phrase
  from the outcome, legal or claim deny-list;
- `followUp` does not ask for an identifier (address, date of birth, A-number, Social Security,
  phone, e-mail, case or receipt number, passport number);
- `tip` contains no quoted sentence and no "say: ..." or "you could say" style model answer;
- `stop_reason` is `end_turn`.
The deny-lists live in `data/coach-deny-list.json` with a review date; tests use fixtures of
blocked and allowed phrases. It is a best-effort guard, not a guarantee; the owner updates the
officeholder list when officeholders change. Anything that fails is dropped and the client falls
back (REQ-C11). Rejections are counted by reason; the text is never logged.

### REQ-C10 — Limits (all in `data/coach-config.json`, all tested)
Initial values (the owner can change them in the config):

| Limit | Value |
|---|---|
| Methods | `POST` only; `OPTIONS` answers 204 with no CORS grant; other methods 405 |
| Origin | `Origin` must be `https://language-lab-ade.pages.dev`, a preview of that project (`https://<id>.language-lab-ade.pages.dev`), or a local dev origin (`http://localhost:8788`, `http://127.0.0.1:8788`); missing or other origin: 403. `Sec-Fetch-Site`, if present, must be `same-origin` |
| Request body | at most 4,096 bytes (`Content-Length` and the read body); otherwise 413 |
| Answer length | at most 600 characters; otherwise 400 (the client blocks it first) |
| Turns per session | 12 (client-enforced; server-counted per random session id) |
| Per IP | 30 per hour and 80 per day |
| Daily request budget | 600 per UTC day, all users |
| Daily spend cap | $0.50 per UTC day |
| Upstream timeout | 8,000 ms; client gives up after 12,000 ms |
| Kill switch | environment variable `COACH_ENABLED` must be exactly `"true"` |

Requests refused with 403, 405 or 413 are not counted. The spend cap reserves the worst-case cost
of a call (input estimate from the text lengths + `max_tokens` output) with one conditional
`UPDATE` before the call, and replaces it with the actual cost (usage × prices) after a reply. On a
timeout or an upstream error the full reserve stays. At or past the cap the endpoint returns
"coach unavailable" until the next UTC day.

### REQ-C11 — Fallback
If consent is off, the answer is screened out, or the endpoint fails, times out, is rate limited,
over budget, switched off, or its reply is rejected, the stage continues with the scripted coach and
shows one plain line: AI feedback is not available right now. When the endpoint says the coach is
switched off, over budget or not configured, the switch turns off for the rest of the session. The
app stays fully usable with the endpoint switched off, the binding missing or the key removed. The
client never retries automatically.

### REQ-C12 — Counters on a free-plan binding
Counters MUST be strongly consistent and available on the Workers Free plan: one D1 database bound
as `COACH_DB`. Raw IP addresses are never stored: the key is SHA-256 of
`ip + ":" + UTC date + ":" + COACH_IP_SALT` (a secret). Without the salt or without the binding,
or on any D1 error, the endpoint fails closed ("coach unavailable"). The hash is pseudonymous, not
anonymous. Rows older than two days are deleted in small batches during normal requests (Pages has
no cron). A counted call writes at most 7 rows (IP hour, IP day, session, day requests, spend
reserve, spend settle, cleanup), so the daily budget of 600 uses at most 4,200 of D1 Free's 100,000
daily writes.

### REQ-C13 — Prompt structure
One fixed system prompt (in code, reviewed). The user message holds one JSON object with only:
`profileName`, `question`, `sampleAnswer` (the fictional profile's, may be null) and `answer`. The
learner's text is a JSON string value inside it, and the system prompt says the object is data to
assess, never instructions. No tools, no web search, no earlier turns, no thinking; strict JSON
schema output.

### REQ-C14 — Interface
On the N-400 screen:
- a switch "AI coach (optional)" (`role="switch"`, accessible name, 48px tap target);
- when it is turned on, the notice of REQ-C07 with "Turn on the AI coach" and "Cancel"; focus moves
  to the notice and back to the switch;
- with the coach on, after an answer is sent a feedback step shows before the next question: the
  AI lines in a polite live region, each with the "AI-generated feedback" label, the feedback as an
  icon and a plain label (never colour alone, no harsh wording), then "Next question";
- the fallback line of REQ-C11 in the same place when AI feedback is not available;
- the three disclaimers (practice only, not legal advice, not a government service) in English.
All text in the locale files; the consent notice and the legal lines are legal keys (English only
until a reviewer is recorded; one translated line says why, as elsewhere). The AI lines are English
(`lang="en"`). The report still does not score N-400 and does not contain AI lines.

### REQ-C15 — Privacy texts and logging
The privacy statements MUST say that the AI coach, when turned on, sends the text of each N-400
answer to Anthropic through Language Lab's server, and nothing when it is off. Updated: the home
privacy note (`voice.privacy`), the setup privacy note (`intro.privacy`), the About & disclaimer
panel, `README.md` disclosure and `NOTICE`, with a link to Anthropic's privacy policy. The Function
never logs request bodies, replies or upstream error bodies; it logs only counts and reason codes.

### REQ-C16 — Tests
Unit and property tests for: config parsing and every limit, the reply validator, the deny-lists,
the identifier screen, prompt-injection attempts in the answer, the endpoint with a mocked
Anthropic client and an in-memory D1 stand-in (no test calls the real API or the network), the
coach client's fallback paths, and a test that the app never calls `/api/coach` while consent is
off. The security-headers test keeps passing; a test checks the Function's own headers.

### REQ-C17 — Deploy notes
`docs/coach-deploy.md`: the D1 database and binding, the schema command, the secret and variable
commands, how to deploy Pages with Functions, how to switch the coach off quickly, how to see usage,
an Anthropic workspace spend limit and an optional Cloudflare WAF rate rule as outer guards, the
cost per session and per day at the configured caps, and how to change the model id.

## Analyze Requirements

### Round 1 (on revision 1, by the author)

| # | Point | Settled |
|---|---|---|
| A1 | The brief asks for temperature in the config; API version `2026-10-21` rejects it. | REQ-C04: key kept, must be `null`, never sent. |
| A2 | A per-IP limit needs IP storage. | REQ-C12: salted, day-scoped hash; deleted after two days. |
| A3 | The server cannot enforce turns per session without accounts. | REQ-C10: client-enforced, server-counted; per-IP and daily limits are the server guards. Open: a limitation. |
| A4 | There is no Privacy screen in the app. | REQ-C15 lists the places changed; no new screen. Open: the owner decides if a dedicated screen is wanted. |
| A5 | No list can catch every officeholder name. | REQ-C09: deny-list, title pattern and prompt; best effort. Open: a limitation. |
| A6 | The follow-up could become an extra turn and call. | REQ-C05: shown only, never answered or sent. |
| A7 | Concurrent requests could overshoot the spend cap. | REQ-C10: atomic reserve, then settle. |
| A8 | The rate-limit binding is not available to Pages. | REQ-C12: D1 for every counter. |
| A9 | Refusals and `max_tokens` replies may not match the schema. | REQ-C09: only `end_turn`. |
| A10 | The consent notice is legal text. | REQ-C14: legal key, English only until reviewed. |
| A11 | Anthropic retention is not in the brief. | REQ-C15 names Anthropic and links its policy. Open: the owner decides on retention terms. |
| A12 | A Pages Wrangler file would override dashboard settings. | No Pages Wrangler file; bindings set in the dashboard or by the commands in the deploy notes. |
| A13 | The identifier screen can block harmless numbers. | REQ-C08 narrow patterns with negative tests; the fictional profiles hold no such numbers. |

### Round 2 (on revision 1, independent reviewer in a clean context; 20 findings)

| # | Finding | Settled |
|---|---|---|
| B1 | "Answer as the fictional person" vs product steering ("answer truthfully from their own circumstances"); the notice should say the screen cannot catch everything. | The owner's brief and content-safety rule 1 (fictional profiles in practice) both say fictional person; kept. Added "the screen cannot catch every personal detail" (REQ-C07). Open: the steering wording and this notice differ; the owner may want to align `product.md`. |
| B2 | `tip` could become a suggested answer; `feedback` undefined. | REQ-C05 defines the three values (clarity and English only) and forbids model answers; REQ-C09 checks quotes and "say:" patterns. |
| B3 | `followUp` could ask for real identifiers. | REQ-C09 deny pattern; REQ-C05 same topic. |
| B4 | Reply language unspecified. | REQ-C06 and REQ-C09: English only. |
| B5 | Prompt structure unspecified. | REQ-C13. |
| B6 | A new public type vs `tech.md` "export from contracts". | REQ-C01: engine-local type, recorded in the decisions log (contracts need a CR first). |
| B7 | Logic placement vs `structure.md`. | REQ-C02: thin handler, pure modules in `src/engine/coach/`. `structure.md` gets the `functions/` folder and the two data files. |
| B8 | No feedback step on the screen; `context.answered` would be sent. | REQ-C14 feedback step; REQ-C01 current turn only. |
| B9 | Accessibility of the switch and AI lines. | REQ-C14. |
| B10 | Consent in English only is weak for ESL learners. | Owner rule: legal text English only until a named reviewer; the translated line says why. Open: accepted risk, recorded. |
| B11 | Loose identifier patterns, no date of birth. | REQ-C08 lists patterns, adds dates, states what is out of scope. |
| B12 | Preview origin wildcard; missing Origin. | REQ-C10 anchored to this project; missing Origin is 403; this stops browsers, not scripts. |
| B13 | No default values. | REQ-C10 table. |
| B14 | D1 errors, unsettled reserves, write budget. | REQ-C10 and REQ-C12: fail closed, keep the reserve, 7 writes per call. |
| B15 | A fixed fallback salt is reversible; cleanup trigger. | REQ-C12: the salt is a required secret; cleanup in requests. |
| B16 | Deny-lists unowned, no fixtures. | REQ-C09: data file with review date, fixtures, owner updates. |
| B17 | Logging can capture transcripts. | REQ-C15: no bodies logged. |
| B18 | The switch shows when the endpoint is off; no provider backstop. | REQ-C11: the switch turns itself off after "unavailable" (no probe before consent, so no call is made without consent). REQ-C17: Anthropic spend limit and WAF rule. Open: a learner may see the notice once and then "not available" while the coach is off. |
| B19 | External facts unverifiable from the repo. | Read from the docs on 2026-11-20; `checkedOn` in the config. |
| B20 | Session id generation. | REQ-C10 and REQ-C11: random per consent, memory only; the per-session cap is advisory. |
