# Language Lab final audit (re-run of the November audit)

- Date: 2026-11-24 (the file is named for the December submission).
- Commit audited: `4b628652422c6d7be7435c14cdbc8fd42ae8f4fe`, branch `release/submission`. It equals `main` (`df8af87b3435d7d04631dfaca0e267daea470c64`) plus four new files under `docs/submission/` (`git diff --name-status main release/submission`). The branch exists only locally; `origin` has no `release/submission`.
- Live site audited: https://language-lab-ade.pages.dev
- Scope: read-only except this file. Scratch files are in `~/ll-audit/` (the temporary production build there was deleted afterwards). No `dist/` was left in the repository. `git status` was clean before and after. I did not read any secret file, did not push or deploy, and did not call the AI model (no answer text was sent to `/api/coach`).

## Method

1. Read `docs/audit/2026-11-audit.md`, `docs/audit/open-findings.md`, `docs/audit/evidence/` and `docs/submission/requirements-checklist.md`.
2. Headers: `curl -sI` on the home page, a JS asset, an MP3, a font, an image and `/api/coach`; compared with `public/_headers`.
3. Secrets: a Python scan of every added line in `git log -p --all` (155 commits, all branches) for 11 patterns, printing only commit, path, pattern and a masked length. Also `git ls-files`, `.gitignore` and the list of every path ever committed.
4. Network and CSP: the layout tool with `--prod`, plus my own CDP script (`~/ll-audit/probe.mjs`) that loads the live site in headless Chrome, clicks through the home AI-coach card, profile, Start, Cancel, "No, practice without AI", the coach switch and "Turn on the AI coach", and logs every request, console message and `securitypolicyviolation` event.
5. Slow profile: the November probe (`docs/audit/evidence/probe.mjs`, 400 kbps, 400 ms latency, 4x CPU) re-run unchanged on a build of this commit, and the same settings in my script against the live site.
6. Code reading: `src/ui/coach/`, `src/ui/screens/N400Screen.tsx`, `src/engine/coach/prompt.ts`, `src/engine/civics-grader.ts`, `src/i18n/legal-keys.ts`, `src/ui/styles/tokens.css`.
7. Also run: `npm run typecheck`, `npx vitest run`, `npm audit`, GitHub API calls for licence, description and CI runs.

## Results at a glance

| # | Area | Result |
|---|---|---|
| 1 | Security headers (live) | The live headers match `public/_headers` for every path checked. CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `frame-ancestors 'none'` are present. No HSTS (F-04). November's SEC-01, SEC-09 and PERF-03 are fixed. |
| 2 | Secrets | No secret value found in 155 commits or in tracked files. Only the example env file is tracked. `.gitignore` covers env files, the dev-vars file, `dist/` and `.wrangler/`. One non-secret hit class (F-03). |
| 3 | Network before consent | The home load makes 4 requests, all to the site's own origin. Walking the coach flow up to and including "Turn on the AI coach" produced 0 requests to `/api/coach` and 0 off-origin requests. The only caller of `/api/coach` is `submit` in `ai-coach-client.ts`, which returns early unless consent was given. |
| 4 | CSP violations | 0 violations: `layout-check --prod` (en, 4 configurations, 25 screens each) and my live-site run. |
| 5 | Licences and disclosures | MIT detected by GitHub. `NOTICE`, README section, image credits and font licence are present and consistent. One history issue (F-02). |
| 6 | Content safety | No breach found in the code paths I read. Civics scoring has no AI import. One rule-5 prominence question (F-07) and one privacy limit of the coach (F-08). |
| 7 | Accessibility | `layout-check --prod` for en passes at 390 px (normal, extra-large) and 320 px (normal, extra-large). Contrast tokens recomputed: all text pairs pass AA. Live spot-check: 1 `h1`, landmarks present, 0 unnamed buttons, 0 unlabelled fields, 0 images without alt. |
| 8 | Performance (slow profile) | First visit 161 KB (November: 248 KB). Main bundle 407 KB raw, 119 KB gzip (November: 838 KB, 207 KB). LCP 6.0 s on a local build and 7.9 s on the live site, against 5.2 s in November (F-01). |
| 9 | Requirements checklist | All "Done" items I could test hold. One wording issue (F-05). The "Owner" items remain (see section 9). |
| - | `npm run typecheck` | Passes (exit 0). |
| - | `npx vitest run` | 1373 passed, 0 failed, 0 skipped, 0 todo; 344 suites in 62 files. |
| - | `npm audit` and `npm audit --omit=dev` | 0 vulnerabilities. Runtime dependencies: `react` and `react-dom` 19.1.0 (MIT). |

Counts: 0 Blocker, 0 High, 4 Medium, 7 Low (11 findings).

## Evidence by area

### 1. Headers on the live site (2026-11-24)

| Path | Result |
|---|---|
| `/` | 200. `cache-control: no-cache`. CSP: `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'`. `permissions-policy: microphone=(self), camera=(), geolocation=(), payment=(), usb=()`. `referrer-policy: no-referrer`. `x-content-type-options: nosniff`. |
| `/assets/index-Dm3G7v4D.js` | Same security headers. `cache-control: public, max-age=31536000, immutable`. |
| `/audio/reading/read-009.mp3` | `audio/mpeg`, same security headers, `max-age=86400`. |
| `/fonts/bitter-latin.woff2` | `font/woff2`, `max-age=604800`. Images: `max-age=86400`. |
| `/api/coach` GET | 405 `{"status":"method"}`. `cache-control: no-store`, `content-security-policy: default-src 'none'; frame-ancestors 'none'`, `nosniff`, `no-referrer`. |
| `/api/coach` POST, `{}`, no `Origin` header | 403 `{"status":"forbidden"}`. |
| `/api/coach` POST, empty body, `Origin` = the site | 400 `{"status":"refused","reason":"bad_request"}` (the request got past the kill switch, key, salt and D1 checks). |
| `/api/coach` POST, foreign `Origin` | 403 `forbidden`. |
| `http://` home page | 301 to HTTPS. |

Every value above equals the matching block in `public/_headers`. Differences: no `Strict-Transport-Security` header (F-04) and `access-control-allow-origin: *` on static files, which Cloudflare adds and `_headers` does not set (F-09). The API responses carry no CORS header.

### 2. Secrets

- Scan: 155 commits (`git rev-list --all`), 11 patterns (`sk-ant-`, `sk-proj-`, `sk-`, `AKIA`, private-key header, `password=`, `api_key`, GitHub tokens, Slack tokens, `AIza`, quoted `secret/token/salt` assignments). 14 hits, none a secret:
  - Commits `ba4cd8d869`, `88e7d150e7`, `09eec53e5f`: `data/sources/uscis-2025-civics-test.html`, `uscis-exceptions-and-accommodations.html`, `uscis-study-for-the-test.html`, `uscis-policy-manual-vol12-parte-ch2.html`, `uscis-2008-civics-100.html`. Patterns `AIza` (39 characters) and `token` (51 characters). It is the page-settings JSON that uscis.gov itself serves (`"uscis_design":{"apiKey_aao_pm_search":"AIza...`), a public browser key belonging to USCIS (F-03).
  - Commit `0c9869b521`: `src/engine/coach/__tests__/handler.test.ts` and `pages-function.test.ts`, patterns `api_key` and `salt`. The values are test placeholders (`"test-key-not-real"`, `"a-test-salt-of-enough-length"`).
- Every path ever committed that looks like an env, dev-vars, key or credential file: only the example env file.
- `.gitignore` (lines 13-19 and 39) lists the env file, its variants (with an exception for the example), the dev-vars file, a pattern for env files under `tools/`, `dist/` and `.wrangler/`. One ignored dot-file exists in `tools/speech-test/` (name only; I did not open it); `git status` is clean, so it is ignored.
- The PreToolUse hook blocked my tool calls that named env paths, including a regex-obfuscated name. SEC-05 (absolute paths in hooks) is fixed: the three hooks use relative commands.
- Limit: pattern-based only; no gitleaks or trufflehog was available.

### 3. Network before consent

- Home load on the live site: `/`, `/fonts/bitter-latin.woff2`, `/assets/index-Dm3G7v4D.js`, `/assets/index-CRujZvHj.css`. 160,903 bytes, 0 console messages, 0 failed requests.
- Coach walk-through on the live site: 0 requests to `/api/coach` at any step, including after "Turn on the AI coach" with no answer submitted. 0 requests left the origin.
- Code: `src/ui/coach/ai-coach-client.ts` is the only caller of `/api/coach`. `submit` returns `{ kind: "off" }` when `consent` is false, and the answer is screened for identifiers and length before `transport` is called. `consent` becomes true only in `giveConsent()`, which `N400Screen.tsx` (line about 101) calls from the notice's confirm button. State is in memory only. A grep found no `localStorage`, `sessionStorage`, `indexedDB`, `sendBeacon`, `XMLHttpRequest`, `WebSocket`, `innerHTML` or `eval` in `src/` outside tests. The only `fetch` in `src/` is `PracticeApp.tsx:48`; the only one in `functions/` is the Anthropic call in `functions/api/coach.ts:29`.
- The coach prompt (`src/engine/coach/prompt.ts` lines 28-37) forbids scoring, outcome predictions, suggesting what to claim, example answers, legal advice and real names.
- Not tested: the model path itself (not allowed).

### 4. CSP violations

`node --no-warnings tools/layout-check/run.mjs --lang=en --size=normal --prod`: "All screens pass" (25 screens; the tool listens for `securitypolicyviolation`). The same result for `--size=extra-large`, and for `--width=320` with both sizes. My live-site run recorded `window.__csp = []`. Only `en` was run.

Note: my first loop over the extra configurations passed the options as one argument (a shell quoting mistake), which made every screen fail with "text size not applied". Those results are invalid and are not counted. The runs were repeated with separate arguments.

### 5. Licences and disclosures

- GitHub API: `visibility: public`, `license.spdx_id: MIT`, `description` and `homepage` set (November KIRO-03 is fixed), default branch `main`, created 2026-11-01T20:42:14Z.
- `NOTICE` has 9 items (code, USCIS documents, pictures, Bitter OFL, AI audio, AI translations, third-party software, AI coach, formN400.org). The README section "Pre-existing work and third-party material" (README.md:222-231) covers the same ground and names the Anthropic `frontend-design` skill (MIT).
- Pictures: 18 entries in `data/images/manifest.json`; all 18 appear in `docs/image-credits.md`; every `rights` line appears word for word in the credits; 18 files on disk, none unlisted. The manifest `sha256` is the hash of the download, not of the stored `.webp`, so it does not match the file on disk (`tools/images/build-images.mjs:10` says so; `NOTICE` item 3 does not). 4 pictures have creator "Unknown" (carried from November CON-13).
- Font: `public/fonts/OFL.txt` (SIL OFL 1.1, Bitter Project Authors); four woff2 files; `@font-face` in `src/ui/styles/fonts.css`; `index.html` has no Google link. The production bundle contains no third-party origin except text references to uscis.gov, si.edu and loc.gov. `package.json` has `license: MIT` and `engines.node >=22.20`.
- The history issue is F-02.

### 6. Content safety (against `.kiro/steering/content-safety.md`)

| Rule | Check | Result |
|---|---|---|
| 1 Fictional profiles | `data/practice/profiles.json`: 3 profiles, each `isFictional: true`, note "Fictional practice profile"; `mock/` files likewise. A regex for A-numbers, SSNs and e-mails over `data/practice`, `mock`, `data/images` and `en.json` found nothing. | Pass. |
| 1 No real-data prompts | `n400.box.reminder` is a legal key; the setup screen says "Profiles are made up. Do not type your real name or any details about you." | Pass. See F-08 for the coach. |
| 2 Never suggest what to claim | The coach prompt forbids it; the scripted answers are shown as the profile's. I did not read every locale string. | Pass in the paths read. |
| 3 Translation | `src/i18n/legal-keys.ts` lists the legal and privacy keys, shown in English in every locale without a named reviewer. All 13 non-English locale files have `source: "ai-draft"`, `reviewedBy: null`, `reviewedOn: null`, so the AI label applies to all. `data/translations/civics/` holds only `en.json` for 2008 and 2025. Four languages (hmn, lo, my, ht) are hidden in production (`IN_REVIEW_LANGUAGES`). | Pass in the working tree. See F-02 for history. |
| 4 Deterministic civics scoring | `src/engine/civics-grader.ts` imports only contracts, the normaliser, config, sentence compare, the answer key and test rules; `scoringSource: "answer_key"`. No import from `engine/coach`. | Pass. |
| 5 Disclaimer on every result surface | Short disclaimer in the footer on every screen (`Footer.tsx`). Prominent version on Home, Report and Part report (`ReportScreen.tsx:107`, `PartReportScreen.tsx:34`, `HomeScreen.tsx:126`). Short one inline on Civics and Credits. | See F-07. |
| 6 No seals | No seal, eagle or insignia asset in `public/`; the only images are the 18 pictures. The favicon is an inline SVG circle. The page description says "not affiliated with USCIS". | Pass. |

### 7. Accessibility

- Layout tool results above (390 px and 320 px; normal and extra-large; 25 screens each; en only).
- Contrast recomputed from the `tokens.css` hex values (WCAG), listed as bg/surface/surface-2. Light: ink 13.67/14.78/12.84, ink-2 7.79/8.42/7.32, teal 5.40/5.84/5.08, amber 4.72/5.10/4.43. Dark: ink 14.39/13.31/12.33, ink-2 8.64/7.99/7.40, teal 6.36/5.88/5.45, amber 6.37/5.89/5.46. Button text on teal and amber: 5.84 and 5.10 (light), 6.36 and 6.37 (dark). The only value under 4.5 is light amber on surface-2 (4.43). The CSS uses amber for icons (`Screen.css:66`, `ReportScreen.css:145`, `StatusBadge.css:26`), where 3:1 applies; I found no amber text.
- Live home and Reading setup screens: `lang="en"`, one `h1`, `header`, `nav`, `main` and `footer` landmarks, 0 unnamed buttons or links, 0 unlabelled fields, 0 images without alt, minimum text 16 px, body 18 px. The only control under 48 px is the "Skip to main content" link.
- `:focus-visible` is defined in `base.css:66`. I could not confirm the ring in headless Chrome, because script-driven focus does not match `:focus-visible`.
- Not checked: screen reader, real phone, Windows forced-colours mode.

### 8. Performance (slow profile: 400 kbps, 400 ms latency, 4x CPU)

| Run | Bytes | Requests | Largest paint | Load |
|---|---|---|---|---|
| November, local build (`probe-prod-slow.json`) | 248,096 | 6 (2 to Google) | LCP 5,160 ms | 5,170 ms |
| This commit, local build, same November script | 159,904 | 4 (own origin) | LCP 6,012 ms | 6,022 ms |
| This commit, live site, my script | 161,007 | 4 (own origin) | LCP 7,916 ms (first contentful paint is the same value) | 7,899 ms |

Main JS: `index-Dm3G7v4D.js`, 406,764 bytes raw, 118,716 bytes gzip on the wire. The 13 locale files (15 to 61 KB each) and the two answer keys load as separate chunks. The page paints nothing until the main script has run, because `index.html` has an empty `#root`.

### 9. Checklist (`docs/submission/requirements-checklist.md`), "Done" claims

| # | Claim | My check | Result |
|---|---|---|---|
| 1 | New project, first commit after 2026-10-30 | First commit `bd9d256` 2026-11-01 10:42 -1000; repository created 2026-11-01T20:42Z. `git rev-list --count main` = 151. | Confirmed. |
| 2, 3, 16 | Disclosure present | README lines 222-231, `NOTICE` items 1-9, `docs/image-credits.md`. | Confirmed (see F-02 for history). |
| 4 | Public GitHub repository | API `visibility: public`. | Confirmed. |
| 5 | Licence detected | API `license.spdx_id: MIT`. | Confirmed. |
| 6 | `.kiro` tracked, not ignored | `git ls-files .kiro` = 25 files (2 agents, 5 hooks, 12 specs, 6 steering); `git check-ignore .kiro` finds no rule. | Confirmed. |
| 7 | Live URL works, serves the main build, no login | 200; the live `index.html` is byte-identical to a build of this commit; the CSS, font and audio manifest hashes match; the JS name `index-Dm3G7v4D.js` matches. | Confirmed. |
| 14 | English materials | Read the four files. | Confirmed. |
| 15 | Runs as described | Counts in `devpost.md` (1373 tests, 104 fast-check properties) match: 1373 passed, 104 `fc.assert` calls. Video claims not replayed. | Partly verified. |
| Extra | "POST with an empty body returns 400" | True only with an `Origin` header. Without it the answer is 403 (F-05). | Needs rewording. |
| Extra | GitHub About set | Description and homepage set. | Confirmed. |
| CI | Not in the checklist | The latest `main` run (`df8af87`) succeeded 2026-11-24T10:20:57Z; an earlier `main` run at 09:51Z and a `release/finish` run failed. | Currently green. |

Remaining for the owner (from the checklist, unchanged by this audit): #8 keep the site and D1 database up until 2027-01-29 1:00 pm PT; #9 paste the description; #10 record and upload the video (under 3 minutes, public on YouTube, no music or logos); #11 paste the Kiro write-up; #12 select the category; #13 add the team member(s) on Devpost and submit as one Representative; #2 copy the disclosure into the Devpost text; optional bonus prizes. Also: the submission documents exist only on the local branch `release/submission` (F-06).

## Findings

Severity: Blocker = would disqualify the submission or expose user data or secrets. High = a real security, privacy, content-safety or rule-compliance problem a judge or user would hit. I made no Blocker or High finding.

| ID | Severity | Area | What | Evidence | Suggested fix |
|---|---|---|---|---|---|
| F-01 | Medium | 8 Performance | On the November slow profile the page is not faster to first paint than in November, although transfer fell by a third. LCP is 6.0 s on a local build of this commit and 7.9 s on the live site (November: 5.2 s). First paint equals LCP, so the screen stays blank until the 407 KB script has run under 4x CPU. | `~/ll-audit/nov-slow-out.json` (November script, this build): `lcp` 6012, `totalBytes` 159904. `~/ll-audit/live-slow.json`: `lcpMs` 7916, `nav.load` 5746. `index.html` has only `<div id="root"></div>`. | Put a static first screen (title, the disclaimer line and a loading status) in `index.html` so something paints before React runs. Keep the answer-key chunks lazy. Re-measure on a real phone. |
| F-02 | Medium | 5 Licences, 6 Content safety | The public git history contains non-English civics translations that content-safety rule 3 says are not in the repository. They were imported from the owner's separate formN400.org project in commit `cd15624` (2026-11-17) and removed in `a375670` (2026-11-20). At least 10 files such as `data/translations/civics/2008/es.json` can still be retrieved from history. `NOTICE` item 9 discloses this and says they are not licensed by this repository. | `git log --all --format='%h %ad %s' -- data/translations/civics/2008/es.json`; `git log --all --diff-filter=A --name-only -- 'data/translations/civics/*/*.json'`. | Keep `NOTICE` item 9 and repeat it in the Devpost disclosure (already in `devpost.md`). Rewriting public history during judging is the owner's call; it would also change the commit dates the checklist relies on. |
| F-03 | Low | 2 Secrets | Five saved USCIS pages in `data/sources/` contain a Google API key string (`AIza`, 39 characters) that uscis.gov embeds in its own page settings. It is not Language Lab's key, but automated secret scanners will flag it. | Commits `ba4cd8d869`, `88e7d150e7`, `09eec53e5f`; one match in each of 5 HTML files in `data/sources/`. | Add one line to `data/sources/README.md` saying these strings come from uscis.gov and are not credentials. Do not edit the saved files: their hashes are recorded. |
| F-04 | Low | 1 Headers | No `Strict-Transport-Security` header on the live site, and none in `public/_headers`. `http://` redirects (301) to HTTPS, and browsers already force HTTPS for `.dev` domains. | `curl -sI https://language-lab-ade.pages.dev/` returns no such header. | Add `Strict-Transport-Security: max-age=31536000` to the first block of `public/_headers`. |
| F-05 | Low | 9 Checklist | The checklist says `POST /api/coach` with an empty body returns 400. A plain request without an `Origin` header returns 403 `forbidden`; 400 `bad_request` appears only when `Origin` equals the site. The commit counts in the checklist are also out of date (Long Nguyen 134 and Tiffanie Nguyen 12 now; the file says 130). | Section 1 of this report; `git shortlog -sne --all`. | Change the sentence to "with the site's Origin header" and update the counts. |
| F-06 | Low | 9 Checklist | The submission documents (`docs/submission/*`) and this report exist only on the local branch `release/submission`. `origin` has no such branch, and checklist item 15 points to `docs/audit/2026-12-final-audit.md` as if it were in the public repository. | `git rev-parse origin/release/submission` fails; `git diff --name-status main release/submission` lists 4 added files. | Owner: merge or push before the deadline so the public repository contains what the checklist cites. |
| F-07 | Medium | 6 Content safety | Rule 5 asks for a prominent disclaimer on every UI surface that shows practice results. Reading, writing and N-400 feedback show results with only the short footer disclaimer. Civics feedback adds a short inline line. The prominent text appears on Home, Report and Part report. I did not judge visual prominence on a device. | `Footer.tsx:13`, `CivicsScreen.tsx:120`, `ReportScreen.tsx:107`, `PartReportScreen.tsx:34`; `EnglishScreen.tsx` has no `Disclaimer`. Carried from November CON-11. | Record a decision that the standing footer meets rule 5 for per-answer feedback, or add the `disclaimer.report` text once under the feedback block of `EnglishScreen.tsx`. |
| F-08 | Medium | 6 Content safety, privacy | The optional AI coach sends the learner's typed N-400 answer to Anthropic after consent. Only number shapes are screened. A learner who types a real name or address instead of the fictional person's would send it. The notice, the field reminder and the setup text all tell the learner not to. The coach is live, so a judge can reach it. | `src/engine/coach/identifier-screen.ts`; `src/ui/coach/ai-coach-client.ts` (call to `screenIdentifiers`); `docs/audit/open-findings.md`, section "AI coach, open". Server caps are in `data/coach-config.json` (600 requests a day, 0.5 USD a day). | Keep as a documented limit. Make sure the first line of the coach notice repeats "answer as the fictional person". |
| F-09 | Low | 1 Headers | Static files are served with `access-control-allow-origin: *` (Cloudflare Pages default). The files are public, so no data is exposed; the API responses have no CORS header. | `curl -sI` of `/` and the JS asset. | None needed. |
| F-10 | Low | 2 Secrets, privacy | Git author lines in the public history include personal addresses (a Gmail address and `kahuola.org` addresses). They are in every clone. | `git shortlog -sne --all`. | Owner awareness. Changing it needs a history rewrite, which is not advised now. |
| F-11 | Low | Evidence | `docs/audit/evidence/probe-locked.mjs` still clicks "Aurora Vance", but the profile is now "Aurora Thistlewood" (`data/practice/profiles.json`). The script no longer runs as written. | `grep -n Aurora docs/audit/evidence/probe-locked.mjs` (lines 40 and 46). | Leave as the record of November. |

## Status of November findings listed as open in `open-findings.md`

| Id or item | November status | Status now | Evidence |
|---|---|---|---|
| SEC-03 (rest): rotate the OpenAI key; keep keys outside the repository | Open, owner | Still open (cannot verify). A dot-file still exists inside `tools/speech-test/` (ignored by git). I did not open it. The hook blocked all my env-path calls. | `ls -A tools/speech-test`; `git status` clean. |
| KIRO-03: repository description and homepage empty | Open, owner | Fixed. | GitHub API: description and homepage set. |
| content-reviewer, Medium: an assisted writing attempt still counts toward the result | Open, decision | Still open. `assisted` is recorded (`practice-flow.ts:759`) and passed to the report (`writingAssisted`, line 819); the decision is unchanged. | `src/engine/practice-flow.ts`, `report-builder.ts:47`. |
| content-reviewer, Low: `compare.setting.writing` does not say 3-letter words must be exact | Open | Changed. The line now states the USCIS spelling rule ("spelling, capital letters and punctuation do not fail the writing test unless the sentence can no longer be understood", `en.json:144`). I did not check whether the 3-letter point was added. | `en.json:144`. |
| content-reviewer, Low: `report.title.onTrack` joins two ideas | Open | Still open. Text unchanged: "Practice complete: each part reached the practice score". | `en.json:31`. |
| content-reviewer, Low: `home.lead`, `setup.lead`, `study.lead`, `help.skip` stay translated | Open | Not re-checked. | n/a |
| ui-reviewer, Low: three notes on the writing screen with no voice | Open | Not re-checked. | n/a |
| ui-reviewer, Low: answer status role switches between status and alert | Open | Not re-checked. | n/a |
| ui-reviewer, Low: N-400 "Try again" loses focus; loading status may not be announced | Open | Not re-checked. | n/a |
| ui-reviewer, Low: font credit English in every language | Open | Still open by design. | n/a |
| audit evidence, Low: `probe-locked.mjs` still clicks "Aurora Vance" | Open | Still open; the profile has since been renamed (F-11). | script lines 40 and 46 |
| Coach: Anthropic retention terms | Open, owner | Still open. | `NOTICE` item 8 links the privacy policy. |
| Coach: names, addresses, receipt and passport numbers not screened | Open | Still open (F-08). | `identifier-screen.ts`. |
| Coach: officeholder deny-list is best effort | Open | Still open. | `data/coach-deny-list.json`. |
| Coach: per-session turn cap advisory on the server | Open | Still open. The client cap is `maxTurnsPerSession` 12; server guards are per-IP (30 an hour, 80 a day) and the daily budget. | `data/coach-config.json`. |
| Coach: notice long, English only in unreviewed languages | Open | Still open. | `legal-keys.ts` lists `coach.notice.text`. |
| Coach: no dedicated Privacy screen | Open | Still open. | n/a |
| Coach: not deployed, no live test against the real API | Open | Changed. It is deployed and configured: a POST with the site's `Origin` and an empty body reaches the 400 `bad_request` check, which comes after the key, salt and D1 checks. A call to the model was not tested (not allowed). | Section 1. |
| Not verified: `_headers` not served by Cloudflare | Open | Fixed. The live headers equal `public/_headers`. | Section 1. |
| Not verified: slow probe not re-run after self-hosting the font | Open | Done. The numbers did not improve (F-01). | Section 8. |
| Not verified: CI has not run on GitHub | Open | Fixed. 16 runs exist; the latest on `main` passed. Two runs at 09:51Z failed earlier the same day. | GitHub API `actions/runs`. |
| Not verified: real device and screen reader | Open | Still open. | n/a |
| Not verified: surname "Thistlewood" checked from memory | Open | Still open. Not re-checked. | n/a |

November's SEC-01 (headers), SEC-02 (Google Fonts), SEC-05 (hook paths), SEC-09 (favicon, now an inline SVG icon in `index.html`), PERF-03 (caching) and DEP-01 (licences, now in `NOTICE`) are fixed as far as this audit checked.

## Not verified

- The AI coach's model path, its answers and its cost behaviour (not allowed to call it). Whether the Anthropic key is valid.
- Any language other than English in the layout tool, in CSP checks and on the live site. The AI label and English-only legal lines in non-English locales were not seen on screen.
- Real iPhone or Android behaviour, microphone permission prompts, speech recognition, audio playback quality, screen readers, Windows forced-colours mode, the visible focus ring (script focus does not trigger `:focus-visible`).
- The 18 picture sources and their rights statements against the source websites; the 264 audio clips; the accuracy of the answer keys (November's independent check was not repeated).
- Whether the surname "Thistlewood" or any profile name matches a real person.
- Secret scan limits: pattern-based, no dedicated scanner, no check of git objects not reachable from any branch, no check of Cloudflare dashboard settings.
- Whether Cloudflare keeps the D1 database and Pages project available until 2027-01-29, and the Devpost form fields, video and YouTube upload.
- The statements in `docs/submission/video-script.md` and `kiro-usage.md` other than the test and property counts.
