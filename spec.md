# Intro animations for puck and bouncers

## Problem

Users don't realise bouncers can be moved — they look like fixed obstacles. Even with onboarding tips, the affordance is missing in the actual game board.

## Solution

Play idle animations on first visit to draw attention to interactive pieces:
- **Puck** — pulse (scale breathe), signals "this is the main piece"
- **Bouncers** — jiggle (z-axis rotation, iOS-style), signals "I can be pushed"

Animations only show for new users (`skillLevel === null`) and are dismissed per piece type on first click.

## Behaviour

- Animations play on puzzle load when user is new (`skillLevel === null`)
- Both loop indefinitely until dismissed
- Clicking a puck dismisses the puck pulse; clicking a bouncer dismisses the bouncer jiggle
- Dismissal is tracked in component state — resets on page reload (no persistence needed)

## Animations

Both use Open Props keyframes, no custom keyframes needed:

- `pulse-puck` — `var(--animation-pulse)`, already infinite
- `jiggle` — `var(--animation-shake-z)` + `animation-iteration-count: infinite`

## Files changed

- `styles.css` — add `@utility pulse-puck` and `@utility jiggle`
- `islands/board.tsx` — add `isNew` prop; `wiggle` state object `{ puck, bouncer }`; apply animation classes; dismiss on `onFocus`
- `routes/puzzles/[slug]/index.tsx` — pass `isNew={user.skillLevel === null}` to Board
- `routes/puzzles/tutorial/index.tsx` — pass `isNew` (always true in tutorial context)
