# formN400 style (branch ui/formn400-style)

Language Lab is served at lab.formn400.org. Its colours and fonts were chosen to match
formN400.org, the owner's separate earlier site, so the two look alike. Only the token values and
the font names were read from `/Volumes/Crucial1TB/N400/index.html` (its `:root` block), read-only.
The style was re-implemented here; no CSS rules, markup, text, images or icons were copied, and
nothing was written to the N400 repository (`NOTICE` item 9).

## Token map (old → new)

| Old token (Reel-to-Reel) | Old value | New token | New value | Note |
|---|---|---|---|---|
| `--bg` | `#f4eee1` parchment | `--bg` | `#f7f8fc` | page |
| `--surface` | `#fbf7ee` | `--surface` | `#ffffff` | cards, header, inputs |
| `--surface-2` | `#efe7d6` | `--surface-2` | `#eef1f9` | a light navy tint (derived, not a formN400 value): selected cards, wells |
| `--ink` | `#2a2118` | `--ink` | `#0d1f3c` | text |
| `--ink-2` | `#574635` | `--ink-2` | `#334166` | text-mid: secondary and small text, control edges |
| — | — | `--ink-3` | `#5d6b87` | text-muted: large text and icons only |
| `--teal` | `#235350` | `--accent` | `#0d2052` | navy (renamed; every use updated) |
| — | — | `--accent-mid` | `#1a3478` | navy-mid: primary hover |
| — | — | `--accent-light` | `#2a4a9e` | navy-light: the focus ring (`--focus-color`) |
| `--amber` | `#98591a` | `--red` | `#b22234` | labels, icons, the recording button (renamed; status uses `--status-attention`) |
| `--border` | `#968255` | `--border` | `#dde2ef` | hairlines only; control edges use `--ink-2` or `--accent` |
| `--on-accent` | `#fbf7ee` | `--on-accent` | `#ffffff` | text on navy and red |
| `--status-positive` | teal | `--status-positive` | `--correct` `#128040` | with `--correct-bg` `#f0fdf4`, `--correct-border` `#bbf7d0` |
| `--status-attention` | amber | `--status-attention` | `--wrong` `#ca1f1f` | with `--wrong-bg` `#fef2f2`, `--wrong-border` `#fecaca` |
| — | — | `--notice-bg`, `--notice-border` | `#fdf6e3`, `#e9d8a6` | the AI-translation notice (derived light amber) |
| `--radius-md` | 8px | `--radius-md` | 14px | cards, buttons, inputs |
| `--shadow-sm`, `--shadow-md` | warm brown | `--shadow`, `--shadow-hover` | `0 4px 24px rgba(13,32,82,.09)`, `0 8px 32px rgba(13,32,82,.15)` | the old names point at `--shadow` |
| `--font-display` | Bitter | `--font-display` | Playfair Display | headings, wordmark |
| `--font-body` | system sans | `--font-body` | Source Serif 4 | body |
| `--font-mono` | system mono | — | removed | unused |
| dark theme blocks | espresso palette | — | removed | light only, `color-scheme: light` |

Sizes are unchanged: 18 / 21 / 24px roots, 56px targets, 64px primary buttons, 16px minimum text,
line height 1.6.

## Contrast (light only)

No formN400 value had to change for contrast. `--ink-3` (text-muted) is 5.0:1 on the page, so it
is allowed only where 4.5:1 is enough (large text and icons); small and secondary text uses
`--ink-2`. Red, the muted colour and the result colours are never used for body text; text inside a
result panel stays `--ink`. The unit test `src/ui/__tests__/contrast.test.ts` reads `tokens.css`
and checks every pair below.

| Foreground | Use | Rule | on `--bg` | on `--surface` | on `--surface-2` | on `--notice-bg` |
|---|---|---|---|---|---|---|
| `--ink` #0d1f3c | body text | 7:1 | 15.48 | 16.43 | 14.54 | 15.23 |
| `--ink-2` #334166 | secondary and small text | 7:1 | 9.47 | 10.05 | 8.90 | 9.32 |
| `--accent` #0d2052 | headings, links | 7:1 | 14.71 | 15.61 | 13.81 | 14.47 |
| `--accent-mid` #1a3478 | hover | 7:1 | 10.95 | 11.63 | 10.29 | 10.78 |
| `--red` #b22234 | bold uppercase labels, icons | 4.5:1 | 6.24 | 6.62 | 5.86 | 6.14 |
| `--ink-3` #5d6b87 | muted large text, icons | 4.5:1 | 5.05 | 5.36 | 4.74 | 4.97 |
| `--accent-light` #2a4a9e | focus ring | 3:1 | 7.69 | 8.17 | 7.23 | 7.57 |

| Pair | Rule | Ratio |
|---|---|---|
| white on navy (primary button) | 7:1 | 15.61 |
| white on navy-mid (hover) | 7:1 | 11.63 |
| white on red (recording button, large bold) | 4.5:1 | 6.62 |
| --correct on --correct-bg (headline, icon) | 4.5:1 | 4.79 |
| --wrong on --wrong-bg (headline, icon) | 4.5:1 | 5.15 |
| --ink on --correct-bg (text in the panel) | 7:1 | 15.69 |
| --ink on --wrong-bg (text in the panel) | 7:1 | 15.02 |

Control edges (`--ink-2`) and the focus ring (`--accent-light`) are 3:1 or more on every background.
`--border` (1.2 to 1.3:1) is decorative: cards also have the shadow, and every control has its own
mark (the radio, the arrow and verb, or a 2px navy edge).

## Font files and licences

Added to `public/fonts/` (woff2, from the Fontsource releases of the Google Fonts families:
`@fontsource/playfair-display` 5.3.0 and `@fontsource/source-serif-4` 5.3.1, SIL OFL 1.1). The
unicode ranges in `src/ui/styles/fonts.css` are the packages' subset ranges.

| Family | Weights | Subsets | Files | Licence |
|---|---|---|---|---|
| Playfair Display (Claus Eggers Sørensen) | 400, 700, 900 | latin, latin-ext, vietnamese | 9 | `public/fonts/OFL-PlayfairDisplay.txt` |
| Source Serif 4 (Frank Grießhammer, Adobe) | 400, 600, 700, italic 400 | latin, latin-ext, vietnamese | 12 | `public/fonts/OFL-SourceSerif4.txt` |

`source-serif-4-latin-400-normal.woff2` is preloaded in `index.html`. Removed: the four Bitter
files (`bitter-latin`, `bitter-latin-ext`, `bitter-vietnamese`, `bitter-cyrillic`) and
`public/fonts/OFL.txt`. Chinese, Korean, Hindi, Thai, Lao and Burmese keep their system stacks in
`scripts.css`; Russian now uses a system serif stack (Georgia, Times New Roman, PT Serif), since no
Cyrillic subset is served. The Credits screen, `NOTICE` item 4, the README and Devpost name the two
families; the security-headers test checks that every font file named in `fonts.css` exists, that
no unnamed font file is left, and that each family's licence is beside its files.

## Screenshots

Production build at 390px, normal text size, taken by the layout tool (`--prod --shots`), kept in
the system temp folder, not in the repository: before (from `main`, the Reel-to-Reel palette) in
`$TMPDIR/ll-style-before`, after in `$TMPDIR/ll-style-after`, 54 images each (27 screens, en and vi).
The ones compared, for both `en` and `vi`:

| Screen | File |
|---|---|
| Home | `<lang>-normal-home.png`, `<lang>-normal-home-language.png`, `<lang>-normal-home-special.png` |
| Study | `<lang>-normal-study-choose.png`, `<lang>-normal-study-question.png`, `<lang>-normal-study-picture.png` |
| Civics question | `<lang>-normal-civics-question.png` |
| Civics result | `<lang>-normal-civics-feedback.png` |
| Report | `<lang>-normal-report.png`, `<lang>-normal-part-report.png` |

Before → after: parchment and brown with teal and amber, Bitter headings and a sans body → page
`#f7f8fc`, white cards with a hairline and a soft navy shadow, navy Playfair headings, a Source Serif
4 body, red uppercase step labels, navy primary buttons, the result panels in the correct (green) or
wrong (red) colour set with the icon and the word, a white header with the navy wordmark (no reel
glyph), and a light amber AI-notice bar.

## Checks (S4)

- Layout check `--prod` (MIN_TARGET 56, every existing rule): 10 production languages at normal
  390px; en and vi at large and extra large, 390px and 320px. 18 runs, 27 screens each, all pass, no
  CSP violation.
- Contrast unit test: light palette only, all pairs pass.
- ui-reviewer on Home, Study, a practice screen, a result, a report, the coach notice and the
  header. Fixed: the disabled Start button took the navy hover with grey text (hover now skips
  disabled buttons); language cells had a near-invisible edge (now a 2px `--ink-3` edge, 5:1); the
  script stacks dropped the Latin fonts (Source Serif 4 and Playfair Display now come first, so
  English questions, "USCIS" and the wordmark keep them); the heading's focus ring was removed for
  keyboard focus too (now only for programmatic focus); `LanguageMenu.css` collapsed to one block
  per selector; the chosen text size shifted by 1px; the current step marker had an invisible ink
  ring (now white with a navy ring, unlike the filled completed steps); stale teal, amber and tape
  comments; `boot.css` used token variables; the reviewer agent banned the uppercase labels the
  design system asks for. Added: more line height for Vietnamese headings (stacked marks).
  Kept: the soft shadow on information panels, because the brief gives every card the shadow;
  tappable cards add the hover shadow, a verb and an arrow, and choices show their radio mark.
