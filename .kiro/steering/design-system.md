---
inclusion: always
---

# Language Lab — Design System

Records the chosen visual direction so all future UI work stays consistent. This is the
source of truth for tokens; the implementation lives in `src/ui/styles/tokens.css`.

## Chosen direction: Reel-to-Reel

The 1970s language lab booth the product is already named for. Individual study carrels,
reel-to-reel warmth, focused repetition. The feeling of pulling the curtain on a quiet
booth and pressing a chunky button to begin.

The product brief pins this metaphor explicitly (`product.md`, `README.md`), so the warm
parchment palette is a *choice the brief asked for*, not the generic cream default. To keep
it from reading as a template, the palette is anchored by **muted teal (lab equipment)** as a
co-equal with the warm tones, and the burnt-amber accent is reserved for active/record states
rather than used as the decorative primary.

### Principles

- **Restraint over gimmick.** Retro character stays in type, color, and one subtle reel
  motif. No heavy paper textures, no skeuomorphic chrome, nothing that competes with text.
- **Readability is the floor.** Users are ESL learners, often older and anxious. Body text
  ≥ 18px, generous line-height, WCAG AA minimum (AAA for body text where feasible), in both
  light and dark mode.
- **Encouraging, never punitive.** The interview is high-stakes for users. Feedback never
  says pass/fail and never uses harsh red. Status is conveyed by icon + label, never color
  alone. Calm teal = on track; warm amber = review this.
- **One memorable thing.** The reel/tape progress motif is the single characterful element;
  everything around it is quiet and disciplined.
- **Motion answers action.** Non-user-triggered motion is rare. Any reel/tape animation
  respects `prefers-reduced-motion`.

## Color

Light mode (parchment booth, lights on):

| Token | Hex | Role | Verified contrast |
|---|---|---|---|
| `--bg` | `#F4EEE1` | Page background | — |
| `--surface` | `#FBF7EE` | Cards / raised panels | ink 14.78:1 |
| `--surface-2` | `#EFE7D6` | Recessed / wells | — |
| `--ink` | `#2A2118` | Primary text | 13.67:1 (AAA) |
| `--ink-2` | `#574635` | Secondary text | 7.79:1 (AAA) |
| `--teal` | `#2C6A66` | Accent, links, on-track status | 5.40:1 (AA) |
| `--amber` | `#9A5A1A` | Active/record, review status | 4.72:1 (AA) |
| `--border` | `#C9BC9F` | Hairline rules / dividers | decorative |
| `--status-positive` | `--teal` | Understood / correct / practice_passed | — |
| `--status-attention` | `--amber` | Needs practice / incorrect / needs_more_practice | — |

Dark mode (espresso booth, amber glow):

| Token | Hex | Role | Verified contrast |
|---|---|---|---|
| `--bg` | `#1F1813` | Page background | — |
| `--surface` | `#271F19` | Cards / raised panels | ink 13.31:1 |
| `--surface-2` | `#2E251E` | Recessed / wells | — |
| `--ink` | `#F0E8D9` | Primary text | 14.39:1 (AAA) |
| `--ink-2` | `#C4B49C` | Secondary text | 8.64:1 (AAA) |
| `--teal` | `#62A89F` | Accent, links, on-track status | 6.36:1 (AA) |
| `--amber` | `#D98A36` | Active/record, review status | 6.37:1 (AA) |
| `--border` | `#4A3D2F` | Hairline rules / dividers | decorative |
| `--status-positive` | `--teal` | Understood / correct / practice_passed | — |
| `--status-attention` | `--amber` | Needs practice / incorrect / needs_more_practice | — |

Button-on-amber pairs: light `#FBF7EE` on `#9A5A1A` = 5.10:1 (AA); dark `#1F1813` on
`#D98A36` = 6.37:1 (AA). Amber is an accent only, never body text.

Color theme is switched via a `data-theme="dark"` attribute on `<html>` (or the user's
`prefers-color-scheme: dark` when no explicit choice is set).

## Typography

Two families, clearly distinct; plus a system monospace accent.

| Role | Family | Stack |
|---|---|---|
| Headings (slab, lab-manual character) | Bitter (web font, weights 400/600) | `"Bitter", "Roboto Slab", "Rockwell", Georgia, serif` |
| Body (humanist sans) | system stack, no download | `system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` |
| Labels / tape readouts (mono accent) | system monospace | `"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace` |

Bitter is a slab serif designed for on-screen reading, so the retro heading character and
ESL readability pull the same direction. Only one web font is loaded (two weights) to keep
the bundle light; body and mono use system stacks with robust fallbacks. Load with
`font-display: swap` so headings render in the serif fallback immediately.

### Type scale (root 16px; `--fs-body` is the 18px floor)

| Token | Value | Use |
|---|---|---|
| `--fs-display` | 2.5rem (40px) | Report headline / page hero |
| `--fs-h1` | 2rem (32px) | Page titles |
| `--fs-h2` | 1.625rem (26px) | Section titles |
| `--fs-h3` | 1.375rem (22px) | Subsection / card titles |
| `--fs-h4` | 1.125rem (18px) | Small headings (bold body) |
| `--fs-lg` | 1.25rem (20px) | Lead / intro text |
| `--fs-body` | 1.125rem (18px) | Body text — minimum for prose |
| `--fs-meta` | 1rem (16px) | Labels, meta, status — minimum visible size |

Line-height: `--lh-tight` 1.2 (headings), `--lh-snug` 1.35, `--lh-body` 1.7 (body, generous),
`--lh-loose` 1.8 (lead). Line length: `--measure` 68ch for prose, `--measure-narrow` 42ch for
forms/inputs. No visible text falls below 16px.

## Spacing, radius, elevation

Spacing scale (`--space-*`): 0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3 / 4 / 6 rem
(4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px). Page gutters use a responsive clamp
(`--gutter`). `--shell-max` 44rem is the single centered column shared by the header,
stepper, main, and footer.

Radius: `--radius-sm` 4px, `--radius-md` 8px, `--radius-lg` 14px, `--radius-pill` 999px.
Cards use `--radius-md`; pill status chips use `--radius-pill`.

Elevation is restrained and warm-tinted (not the generic neutral grey shadow):
`--shadow-sm` `0 1px 2px rgba(42,33,24,.06)`, `--shadow-md` `0 2px 8px rgba(42,33,24,.08)`.

## App shell layout

Header, stage stepper, main workspace, and footer all live inside one centered content
column (`--shell-max` 44rem), so they share a single aligned width and the shell never
stretches edge-to-edge on large screens. The active stage fills the column (≈75ch line
length, under the 80ch readability limit); the page background fills the side margins.

```
Desktop
┌───────────────────────────────────────────────────────┐
│ ◐ Language Lab                  About & disclaimer › │  header
├───────────────────────────────────────────────────────┤
│ 1 Intro ─ 2 N-400 ─ 3 Reading ─ 4 Writing ─ 5 Civics ─ ● Report │  stage stepper
├───────────────────────────────────────────────────────┤
│                                                       │
│                   main workspace                      │  active stage panel
│                   (Report screen)                     │
│                                                       │
├───────────────────────────────────────────────────────┤
│ Not affiliated with USCIS or any agency · Not legal advice │  footer disclaimer
└───────────────────────────────────────────────────────┘
```

```
Mobile
┌─────────────────────────┐
│ ◐ Language Lab    About │  header (disclaimer collapses to icon)
│ Stage 5 of 6 · Civics   │  stepper condenses to current stage + progress bar
├─────────────────────────┤
│                         │
│     main workspace      │
│                         │
├─────────────────────────┤
│ Not affiliated · Not    │  footer
│ legal advice            │
└─────────────────────────┘
```

- **Header.** Brand mark with a small reel glyph; an accessible "About & disclaimer" control
  that expands the standing disclaimer. The disclaimer is always reachable.
- **Stage stepper.** The five stages plus report, in order. Each step shows a number, a
  label, and a status icon (completed = check, current = filled marker). Status is never
  color-only. Desktop: full horizontal stepper; mobile: current stage name + a thin progress
  bar (the restrained "tape" motif).
- **Main workspace.** The single active stage panel, driven by `InterviewSession` /
  `mock/session.json`. Same shell, content swaps per stage. The fixture is in the report
  stage, so the Report screen is the first to render real data.
- **Footer.** The standing disclaimer (not affiliated / not legal advice), always visible.

## Status & feedback semantics

The report uses `practice_passed` / `needs_more_practice` (never pass/fail). Outcomes and
per-item status are shown with an icon + a plain-language label, never color alone:

- **On track** (understood, correct, practice_passed) → check icon, teal accent.
- **Review this** (needs_practice, incorrect, needs_more_practice) → a small "review" marker,
  amber accent, with the specific item to revisit.

No harsh red anywhere. Feedback copy is encouraging and specific ("Review the name of the
current President" — not "Wrong").

## Accessibility floor

- Body text ≥ 18px; generous line-height; AA minimum, AAA for body where feasible (both themes).
- Minimum tap target 44px (`--tap-min`); all interactive controls meet it.
- Visible keyboard focus: a 3px teal focus ring with offset on every focusable element.
- Full keyboard navigation; the stepper and report are operable without a pointer.
- Status and progress never rely on color alone (icon + label always present).
- `prefers-reduced-motion: reduce` disables any reel/tape animation and substitutes a
  static, equally legible state.
- Semantic HTML: landmarks (`header`, `nav`, `main`, `footer`), headings in order,
  `aria-current` on the active stage, list semantics for stages and review items.

## Motion policy

Characterful motion is limited to the reel/tape progress motif and is subtle. Anything
non-essential is removed under `prefers-reduced-motion`. Motion should answer an action
(entering a stage, completing a turn), not decorate passively. No fade-and-slide on every
section.
