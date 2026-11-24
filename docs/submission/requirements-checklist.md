# Kiroween 2026 — Requirements checklist

Sources, read 2026-11-20:
- Hackathon page: <https://kiroween.devpost.com/>
- Official Rules: <https://kiroween.devpost.com/rules>

kiro.dev has no separate rules page; it links to the Devpost page. The quotes below are short excerpts
from those two pages.

## Dates

- **Deadline**: "Deadline: Dec 4, 2026 @ 2:00pm PST" (hackathon page). The Rules: "Submission Period:
  October 30, 2026 (9:00 am Pacific Time) – December 4, 2026 (2:00 pm Pacific Time)" and "No
  extensions will be granted. Late Submissions will not be accepted."
- **Judging**: "Judging Period: December 16, 2026 (1:00 pm Pacific Time) – January 29, 2027 (1:00 pm
  Pacific Time)". Winners are announced on or around February 3, 2027.
- **App availability**: the Rules: "The Entrant must make the Project available free of charge and
  without any restriction, for testing, evaluation and use by the Sponsor, Administrator and Judges
  until the Judging Period ends." So the live site must stay up and free until **January 29, 2027,
  1:00 pm PT**.

## Judging criteria (Rules, section 6)

Stage One is pass/fail: does the project "reasonably fits the theme and reasonably applies the
required tools". Stage Two uses "equally weighted criteria":

| Criterion | Weight | What the page asks (short) |
|---|---|---|
| Potential Impact | 20% (10 points) | A real problem for a real audience; useful, intuitive, accessible |
| Technological Implementation | 20% (10 points) | How thoroughly and skilfully the project uses Kiro |
| Design | 20% (10 points) | A complete, coherent product experience |
| Innovation/Idea | 20% (10 points) | Creative and novel; public resources used in a new way |
| Presentation | 20% (10 points) | The video shows it working end to end; problem, audience, why it matters |

## Requirements

Status key: **Done** (with evidence), **Owner** (yours to do on Devpost, YouTube or GitHub), **N/A**.

| # | Requirement (Rules) | Status | Evidence |
|---|---|---|---|
| 1 | New project, built during the Submission Period (from Oct 30, 2026) | Done | First commit `bd9d256` 2026-11-01 10:42 HST; GitHub repository created 2026-11-01T20:42Z; 151 commits since |
| 2 | Disclose pre-existing code or work incorporated | Done in the repository; **Owner** to copy it into the Devpost text | `README.md` "Pre-existing work and third-party material"; `NOTICE` items 2–9. Includes NOTICE item 9: earlier history held civics translations imported from the owner's separate formN400.org project, since removed from the working tree. `docs/submission/devpost.md` repeats all of it |
| 3 | Third-party SDKs, APIs and data used under their terms | Done | `NOTICE` (USCIS public documents, federal pictures with rights lines, Bitter under OFL 1.1, OpenAI TTS clips, Anthropic API under the trademark guidelines, React MIT); `docs/image-credits.md`; `data/sources/README.md` |
| 4 | Public GitHub repository (not GitLab or Bitbucket) with all source, assets and instructions | Done | <https://github.com/nguyenhuulong2222/language-lab>: `visibility: public` (GitHub API, 2026-11-20); README "Local Development" |
| 5 | Open-source licence file, detected and shown in the About section | Done | `LICENSE` (MIT); the GitHub API reports `license.spdx_id: "MIT"` |
| 6 | `/.kiro` at the root, not in `.gitignore` | Done | `.kiro/` has agents, hooks, specs and steering; 25 tracked files; `git check-ignore .kiro` finds no rule |
| 7 | URL to the working app, free and without login | Done | <https://language-lab-ade.pages.dev> answers 200 and serves the `main` build (bundle `index-Dm3G7v4D.js`, same as a local build of `main`); no login |
| 8 | Keep the app available until the Judging Period ends (Jan 29, 2027) | **Owner** | Cloudflare Pages free plan; keep the project and the D1 database. The AI coach's daily budget limits cost (`data/coach-config.json`) |
| 9 | Text description of features and functionality | Drafted; **Owner** to paste | `docs/submission/devpost.md` |
| 10 | Demo video under 3 minutes, on the intended device, public on YouTube, no third-party trademarks or copyrighted music | **Owner** to record and upload | Script and checklist: `docs/submission/video-script.md` (2:45, iPhone). Avoid music and logos |
| 11 | Write-up on how Kiro was used | Drafted; **Owner** to paste | `docs/submission/kiro-usage.md`; README "How Kiro was used" |
| 12 | Category | **Owner** to select | Resurrection (the 1970s language lab); stated in `docs/submission/devpost.md` |
| 13 | Team of up to 3; one Representative submits | **Owner** | Long Nguyen and Tiffanie (git authors on `main`: Long Nguyen about 130 commits, Tiffanie Nguyen 12, plus GitHub web commits). Add Tiffanie as a team member on Devpost |
| 14 | Submission materials in English | Done | All submission documents are English |
| 15 | Runs as shown in the video and the description | Done in the repository | Every video claim is checked against the live app in `docs/submission/video-script.md`; final audit `docs/audit/2026-12-final-audit.md` (0 blocker, 0 high). These files are on branch `release/submission`; **Owner** merges it so they are public |
| 16 | Original work, solely owned, no IP infringement | Done in the repository; Owner confirms on the form | `NOTICE`; Anthropic attribution is text only (`docs/decisions-log.md` section M); formN400.org material removed (`NOTICE` item 9) |

## Bonus prizes

| Prize | What is needed | Status |
|---|---|---|
| Best Demo | Nothing extra: judged on the Presentation score | Automatic |
| Social Blitz | A public post that starts with `#KiroweenHackathon26`, during the Submission Period, with its URL on the form | **Owner**, optional |
| Bonus Blog | A public blog post on a third-party platform that says it is written for the Kiroween 2026 hackathon, published during the Submission Period, with its URL | **Owner**, optional |
| Best Student Project | Every member a student, with LinkedIn, student e-mail, year, degree and school | **Owner** decides (N/A unless both are students) |
| Best Startup Project | A founder, with LinkedIn and startup website | N/A unless you are submitting as a startup |
| Best Ghost of Kiroween Past | Registered for Kiroween 2025 | **Owner** to confirm if true |
| Best Kiro Crew App | A separate Kiro Crew app repository | N/A (not built with Kiro Crew) |

## Not required but checked

- **Live coach**: `POST /api/coach` with an empty JSON body and `Origin: https://language-lab-ade.pages.dev`
  returns 400 `bad_request`; without that `Origin` header it returns 403 `forbidden`. That check runs
  after the kill switch, the API key, the salt and the D1 binding in `src/engine/coach/handler.ts`,
  so the coach is switched on and configured on the live site. Whether the key works was not tested
  (that would call the model).
- **GitHub About**: the description and the homepage are set (closes audit KIRO-03).
