---
inclusion: always
---
# Language Lab — Design System

Records the chosen visual direction so all future UI work stays consistent. This is the
source of truth for tokens; the implementation lives in `src/ui/styles/tokens.css`. The token
map from the earlier palette and the contrast table are in `docs/ui/formn400-style.md`.

## Chosen direction: the formN400 look

Language Lab is served at lab.formn400.org. Its colours and fonts match formN400.org, the owner's
separate earlier site, so the two look alike: a calm navy and white study page with a red accent,
serif type throughout. The style is re-implemented here from the token values and font names only;
no code, text, data or images come from formN400.org or the N400 repository.

The language-lab idea (listen, speak, compare, repeat) is what the product brings back, not the
colours of a 1970s booth. There is no retro decoration: no tape counter, no reel glyph, no textures.

### Principles

- **Readability is the floor.** Users are ESL learners, often 60 to 85. Body text 20px at normal
  size, line height 1.6, AAA contrast for every piece of body and small text.
- **One main action per screen.** Exactly one filled navy button (or the filled "Practice test"
  card on Home); everything else is outlined or a white card.
- **Tappable things look tappable.** A white card with a frame, an arrow and a visible verb, and a
  stronger shadow on hover. Plain text never looks like a button.
- **Never colour alone.** Status always has an icon and a word as well as its colour.
- **Encouraging copy.** Results say "This counts" or "Not yet", never pass or fail.
- **Independent, not official.** Navy and red are the owner's brand colours, not a government
  look: no seals, no eagle, no "official" wording; the disclaimer stays on every screen.

## Color (light only)

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `--bg` | `#f7f8fc` | Page background | — |
| `--surface` | `#ffffff` | Cards, header, inputs | — |
| `--surface-2` | `#eef1f9` | Light navy tint: selected cards, wells | — |
| `--ink` | `#0d1f3c` | Body text | 15.5:1 on bg (AAA) |
| `--ink-2` | `#334166` | Secondary and small text; control edges | 9.5:1 on bg (AAA) |
| `--ink-3` | `#5d6b87` | Muted: large text and icons only | 5.0:1 on bg (4.5 floor) |
| `--accent` | `#0d2052` | Navy: headings, links, primary buttons, selected frames | 14.7:1 on bg |
| `--accent-mid` | `#1a3478` | Hover of the primary button | 10.9:1 on bg |
| `--accent-light` | `#2a4a9e` | Focus ring | 7.7:1 on bg |
| `--red` | `#b22234` | Bold uppercase labels, icons, the recording button | 6.2:1 on bg (large/bold only) |
| `--border` | `#dde2ef` | Hairlines and card frames (decorative) | — |
| `--on-accent` | `#ffffff` | Text on navy (15.6:1) and on red (6.6:1, large bold) | — |
| `--correct` / `-bg` / `-border` | `#128040` / `#f0fdf4` / `#bbf7d0` | "This counts" headline, icon, panel | 4.8:1 (large text and icon) |
| `--wrong` / `-bg` / `-border` | `#ca1f1f` / `#fef2f2` / `#fecaca` | "Not yet" headline, icon, panel | 5.4:1 (large text and icon) |
| `--notice-bg` / `-border` | `#fdf6e3` / `#e9d8a6` | The AI-translation notice bar | ink 15.2:1 |

No dark theme: `color-scheme: light` and `<meta name="color-scheme" content="light">`.
Text inside a result panel stays `--ink`; only the large headline and the icon take the result
colour. The contrast unit test (`src/ui/__tests__/contrast.test.ts`) reads `tokens.css` and checks
text 7:1, large text and icons 4.5:1, control edges and focus 3:1.

## Typography

| Role | Family | Stack |
|---|---|---|
| Headings, wordmark | Playfair Display 400 / 700 / 900 | `"Playfair Display", Georgia, "Times New Roman", serif` |
| Body, labels, buttons | Source Serif 4 400 / 600 / 700, italic 400 | `"Source Serif 4", Georgia, "Times New Roman", serif` |

Both are self-hosted woff2 files in `public/fonts/` (latin, latin-ext, vietnamese subsets; SIL OFL
1.1, licence texts beside them); the latin body font is preloaded. Nothing loads from Google.
Chinese, Korean, Hindi, Thai and Russian use the system stacks in `scripts.css`.

Small uppercase labels (the step line "STEP 3 OF 6: READING", the "AI" badge, the report label):
red, bold, letter-spaced (`--label-tracking`), never below 16px.

### Type scale (root 18px at normal, 21px large, 24px extra large; `--fs-body` 1.125rem = 20px)

`--fs-display` 2.25rem, `--fs-h1` 1.875rem, `--fs-h2` 1.5rem, `--fs-h3` 1.3125rem, `--fs-h4`
1.1875rem, `--fs-lg` 1.25rem, `--fs-body` 1.125rem, `--fs-meta` 1rem (18px; no visible text below
16px). Line heights: `--lh-tight` 1.2, `--lh-snug` 1.5, `--lh-body` 1.6. Line length `--measure` 34em.

## Spacing, radius, elevation

Spacing `--space-1` to `--space-9`: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px. `--shell-max`
44rem is the one centred column for the header, main and footer. Radius `--radius-md` 14px for cards,
buttons and inputs; `--radius-pill` for chips. Shadows: `--shadow` `0 4px 24px rgba(13,32,82,.09)`
on cards; `--shadow-hover` `0 8px 32px rgba(13,32,82,.15)` on tappable cards when hovered.

## Components

- **Header.** A white bar with a bottom rule: the navy Playfair wordmark "Language Lab", then "Text
  size" and the language button (globe and the language's own name). One row at normal size.
  "About & disclaimer" is a big button in the footer.
- **Back to Home.** A 56px outlined button with an arrow at the top of every screen but Home; in a
  practice it asks "Keep practicing / Leave" first.
- **Step line.** Under Back to Home: "STEP 3 OF 6: READING" as a red uppercase label, with a thin
  navy progress bar.
- **Buttons.** Primary: navy, white text, 64px, full width on a phone. Secondary: white with a 2px
  navy edge. Recording: red with white large bold text.
- **Cards.** White, 1px hairline, 14px radius, the soft shadow; tappable cards add the hover shadow,
  an arrow and a verb (`ActionCard`).
- **Radio and choice cards.** A 2px frame; selected: 2px navy frame, light navy tint, and the radio
  or check mark. The whole card is the target, 56px or more (72px on Home).
- **Results.** The correct or wrong colour set on the result panel, a large headline with an icon
  and a word ("This counts" / "Not yet"), then one short reason.
- **AI notice.** A light amber bar: one line in the chosen language with an info icon, the English
  line under it, and the legal-English sentence behind "More".
- **Language grid.** White cells; the chosen one has a 2px navy frame, a tint, bold text and a
  check. No flags.
- **Disclaimer.** White with a red left rule ("Please read this").

## Accessibility floor

- Body text 20px at normal size; line height 1.6; body and small text 7:1 or more; red, muted and
  result colours only for large text and icons (4.5:1 or more).
- Minimum tap target 56px (`--tap-min`, grows with the text size); primary buttons 64px.
- Text size (normal 18px, large 21px, extra large 24px root) and slower voice live in memory only.
- Visible keyboard focus: a 3px navy-light ring (`--focus-color`), offset 3px, on every focusable
  element.
- Status and progress never rely on colour alone (icon + word always present).
- `prefers-reduced-motion: reduce` removes transitions.
- Semantic HTML: landmarks, headings in order, `aria-current` on the active step and language.

## Motion policy

Motion only answers an action (a hover shadow, the "More" arrow turning). No page-load animation,
no fade-and-slide on sections.
