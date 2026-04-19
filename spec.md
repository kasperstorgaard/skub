# Guard future puzzles and dev-only solver

## Problem

Knowing a puzzle slug lets you play ahead — future puzzles are loadable by
direct URL. The BFS solver dialog is also available in production, making it
trivial to cheat.

Additionally, listing exclusion is inferred from `onboardingLevel` which
doesn't generalise — the upcoming endgame puzzle (Loke) needs exclusion too
but isn't onboarding.

## Solution

### `hidden` flag

Add `hidden?: boolean` to puzzle frontmatter and manifest. Replaces the
`!entry.onboardingLevel` filter in `getAvailableEntries()` and
`getFutureEntries()` with `!entry.hidden`.

`onboardingLevel` stays for ordering the onboarding sequence — `hidden`
takes over the "should this appear in listings" concern.

Puzzles with `hidden: true`:
- `tutorial.md` (onboarding level 1)
- `lars.md` (onboarding level 2)
- `lone.md` (onboarding level 3)

### Future puzzle guard

Middleware at `routes/puzzles/[slug]/_middleware.ts` — runs before all child
routes. Loads the puzzle by slug, returns 404 if the puzzle's number is beyond
today's day-of-year. Numberless puzzles (onboarding, endgame) are always
allowed. Dev bypasses the guard entirely.

Covers all `[slug]` routes in one place — no inline checks needed.

### Solver dialog

`SolveDialog` island gated behind `isDev` so it only ships in local dev:
- `routes/puzzles/[slug]/index.tsx`
- `routes/puzzles/tutorial/index.tsx`

## Files

- **modified** `game/types.ts` — `hidden?: boolean` on `Puzzle` and `PuzzleManifestEntry`
- **modified** `game/loader.ts` — listing filters use `!entry.hidden`
- **modified** `lib/manifest.ts` — include `hidden` in manifest generation
- **modified** `static/puzzles/tutorial.md` — `hidden: true`
- **modified** `static/puzzles/lars.md` — `hidden: true`
- **modified** `static/puzzles/lone.md` — `hidden: true`
- **added** `routes/puzzles/[slug]/_middleware.ts` — future puzzle guard
- **modified** `routes/puzzles/[slug]/index.tsx` — solver gated behind isDev
- **modified** `routes/puzzles/tutorial/index.tsx` — solver gated behind isDev
