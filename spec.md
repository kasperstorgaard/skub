# CSS diet

Shrinks the render-blocking stylesheet from 20.1 KB to 13.2 KB gzipped
without changing how anything looks.

## Problem

The built stylesheet, measured by section (each section gzipped on its own,
so they don't sum to the total):

| Section                                     | raw     | gz     |
| ------------------------------------------- | ------- | ------ |
| `@font-face` + `open-props.min.css`         | 31.3 KB | 8.2 KB |
| `open-props/normalize` (`@layer base`)      | 10.7 KB | 2.8 KB |
| `styles/buttons.css` + `styles/themes.css`  | 7.4 KB  | 1.9 KB |
| Tailwind `@theme` variables                 | 6.0 KB  | 1.3 KB |
| Tailwind utilities                          | 33.1 KB | 6.7 KB |

Open Props is imported whole: every colour scale, every easing, every
gradient, every shadow, for a site that uses a few dozen tokens. The July
Lighthouse run put this stylesheet at 806 ms of render blocking on mobile,
which is the gap between TTFB and FCP once the server is fast.

## Approach

**Own the Open Props tokens in use.** Importing Open Props by module was the
plan, but measured it only reached 18.4 KB: each module still ships its whole
family (50 easings for the 4 we use, 23 animations for 5). Instead
`styles/tokens.css` holds the ~120 Open Props values the app references,
copied verbatim from Open Props 1.7.23, plus the keyframes of the five
animations in use and the dark-mode shadow override. It keeps the
`:where(html)` selector and stays unlayered, so the cascade is unchanged.
Normalize is still imported from the package.

**Trim the `@theme` mirror to match.** Entries like `--ease-1: var(--ease-1)`
are always emitted by Tailwind (the self-reference counts as a use) and were
cyclic once their token was gone. The mirror now lists only tokens that exist
in `tokens.css`.

**Scan markup only.** Tailwind was generating utilities from words in
`specs/`, `candidates/`, e2e files and skill docs (`container`, `table`,
`js:inline-flex`, …). Those paths are excluded with `@source not`, which
leaves new UI directories scanned by default.

**Guard it.** `deno task check-css` reads the built CSS and fails on any
`var(--…)` (in the CSS or in UI source) that resolves to nothing, so a token
used later but never copied is caught instead of failing silently. It also
fails when the stylesheet grows past 14 KB gzipped, which leaves headroom over
today's 13.1 KB. It runs in the PR workflow after a build.

**Normalize** stays: it is the one dependency with a real cross-browser job,
and swapping it would change how things look.

## Result

| Section                                     | before          | after          |
| ------------------------------------------- | --------------- | -------------- |
| Open Props tokens + keyframes               | 29.0 KB / 7.9 KB | 4.8 KB / 1.6 KB |
| Tailwind `@theme` variables                 | 6.0 KB / 1.4 KB | 3.4 KB / 1.0 KB |
| Tailwind utilities                          | 29.3 KB / 6.2 KB | 27.9 KB / 6.0 KB |
| normalize, buttons, themes                  | unchanged       | unchanged      |
| **Whole file** (`gzip -6`)                  | **88.5 KB / 20.1 KB** | **60.4 KB / 13.2 KB** |

Checked against the previous build: base and components layers are
identical, every token value is identical, and the utilities that went away
are only the ones generated from prose. `js:` and `noscript:` variants still
compile.

## Tests

Visual. Ask Kasper to compare the home, puzzle, archives and profile pages in
two themes (skub, high-contrast) before and after, since dropped variables
fail silently as `initial` values.

## Acceptance

No visual difference in the four pages across the themes. Lighthouse
render-blocking estimate for the stylesheet, measured after deploy.

## Open questions

- **12 KB isn't reachable without a visual change.** After this, the sheet
  is utilities (6.0 KB), normalize (2.8 KB), seven themes (1.8 KB) and
  Tailwind's `@property` fallbacks (0.5 KB). The next lever is a lighter
  reset than normalize, which needs a side-by-side comparison.
- **`--size-fluid-0` doesn't exist** in Open Props, so
  `.icon-btn[data-size="sm"]` computes its padding to 0. It was like that
  before; fixing it changes how small icon buttons look. The check script
  lists it as known.
- **The token vocabulary is now closed.** Using an Open Props token for the
  first time means copying it into `tokens.css` and the `@theme` mirror. The
  check script catches a missing token, but a utility whose `@theme` entry
  doesn't exist (`gap-6`) silently falls back to Tailwind's default spacing.
- The 300 font weight was used only by the move counter, which already rendered
  with the 400 file; its `@font-face`, file, token and class are gone.

## Non-goals

- Inlining critical CSS. The whole sheet at 13 KB is close to a critical
  subset already; the split is not worth the tooling.
- Changing design tokens or themes. See the theme memory for that direction.
