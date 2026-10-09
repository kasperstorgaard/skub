# CSS diet

Brings the render-blocking stylesheet from 20.2 KB to ≤ 12 KB gzipped.

## Problem

The built stylesheet, measured by section (gzipped):

| Section                              | raw     | gz     |
| ------------------------------------ | ------- | ------ |
| `@font-face` + `open-props.min.css`  | 31.3 KB | 8.2 KB |
| `open-props/normalize` (`@layer base`) | 10.7 KB | 2.8 KB |
| `styles/buttons.css` + `styles/themes.css` | 7.4 KB | 1.9 KB |
| Tailwind `@theme` variables          | 6.0 KB  | 1.3 KB |
| Tailwind utilities                   | 33.1 KB | 6.7 KB |

Open Props is imported whole: every colour scale, every easing, every
gradient, every shadow, for a site that uses a dozen colour tokens, a handful
of sizes and a few easings. It is 40 % of the gzipped CSS. The July Lighthouse
run put this stylesheet at 806 ms of render blocking on mobile, which is the
gap between TTFB and FCP once the server is fast.

## Approach

**Import Open Props by module.** The package ships per-feature files
(`open-props/sizes`, `open-props/easings`, `open-props/colors-hsl`, individual
colour scales, `open-props/fonts`, `open-props/borders`, `open-props/shadows`,
`open-props/animations`). Grep the codebase and the two theme files for the
`--*` variables actually referenced and import only those modules. Expect the
first section to drop to roughly a third.

**Prune the `@theme` mirror.** `styles.css` re-exports Open Props into
Tailwind's theme (every easing, every animation). Tailwind v4 only emits
variables that utilities use, but the `@theme` block itself still has to be
maintained; trim it to what the grep found so the two lists match.

**Normalize.** Open Props normalize is the one dependency with a real
cross-browser job. Keep it unless the trimmed imports leave it as the largest
block; then weigh a lighter reset.

**Check the fonts.** Three weights are declared; the 300 weight is used once
(`font-3` in the controls panel). Not a CSS-size issue (the `@font-face` rules
are small) but note it for the `/frontend` pass.

## Tests

Visual. Ask Kasper to compare the home, puzzle, archives and profile pages in
two themes (skub, high-contrast) before and after, since dropped variables
fail silently as `initial` values. A grep that every `var(--…)` referenced in
`styles/`, `components/`, `islands/`, `routes/` resolves to a declared
variable in the built CSS makes a good pre-review check; add it as a
`scripts/check-css-vars.ts` task if it earns its keep.

## Acceptance

Built CSS ≤ 12 KB gzipped. No visual difference in the four pages across the
themes. Lighthouse render-blocking estimate for the stylesheet under 300 ms.

## Non-goals

- Inlining critical CSS. The whole sheet at 12 KB is close to a critical
  subset already; the split is not worth the tooling.
- Changing design tokens or themes. See the theme memory for that direction.
