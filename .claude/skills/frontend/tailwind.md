# Tailwind, design tokens, components & CSS

## Tailwind

- Prefer utility classes per element over global utils. Exception: native-like
  components like `.icon-btn` where wrapping in a component just bloats.
- Break long class strings across multiple lines with `clsx`.
- Media queries (`size`, `print`, etc.) each get their own line.
- Order: positioning and sizing first, "look" last (text, border, bg, etc.).

## clsx

- Use for conditionals: prefer `isSomething && "hidden"` over object syntax.
- Never extract classes into consts — extract a local component instead if
  duplication gets heavy.

## Design tokens

The design tokens are the Open Props values in use, copied into
`styles/tokens.css`; only those exist. `styles.css` mirrors them into Tailwind's
`@theme` and extends them. Normalize still comes from
`node_modules/open-props/normalize.min.css`.

To use an Open Props token for the first time, copy it verbatim from
`node_modules/open-props/open-props.min.css` into `tokens.css`, and add its
`@theme` entry if a utility needs it. A utility without an `@theme` entry
(`gap-6`) silently falls back to Tailwind's default scale.
`deno task build && deno task check-css-vars` catches a `var(--…)` that resolves
to nothing.

## CSS

Don't touch styles.css unless specifically fixing a global style bug or
extending the design system tokens. If you feel like a new global component
class is warranted, ask for confirmation.
