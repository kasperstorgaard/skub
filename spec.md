# Back arrow & celebration exit: split today vs archived

## Problem

The back arrow on every puzzle page hardcodes `href="/"`, and the
CelebrationDialog has a hardcoded "Home" tertiary link. For archived puzzles
this is wrong twice: players exploring the archive get bounced to the home
page both via the header back arrow and via the dialog after solving. Worse,
the archive landing page lands on *today* rather than the day they were
browsing — re-finding their place is friction every time.

## Approach

Compute a single `back: { href, label }` on the puzzle page and pass it to
both the header and the CelebrationDialog:

- today's daily puzzle → `{ href: "/", label: "Home" }`
- archived daily puzzle → `{ href: "/puzzles?date=YYYY-MM-DD", label: "Archives" }`
  where the date is the puzzle's release date (year of `createdAt` + day-of-year
  from `number`). The archive page already reads `?date=YYYY-MM-DD` via
  `getArchiveDate`, so it lands on the correct calendar day — preserving the
  user's place in the archive.

Two new utilities:

- `isTodaysPuzzle(puzzle)` in `game/date.ts` — pure predicate comparing
  `puzzle.number` to today's day-of-year. Returns false for entries without a
  `number`.
- `getPuzzleArchiveHref(puzzle)` in `game/url.ts` — builds the archive URL
  with the day param via `Temporal.PlainDate`. Sits next to `getArchiveDate`
  so the read and write sides of the date param live together.

CelebrationDialog now requires a `back` prop (no defensive defaults).

## Non-goals

- Back arrow split for solutions / og-image / clone subroutes — only the
  puzzle detail page is affected.
- Touching SolutionDialog — its dismissal path is structurally different
  (name-entry flow, not a tertiary "leave" link).
- Contextual `aria-label` on the header back arrow ("Back to archives" vs
  "Back to home"). Currently a generic "Back" — left for a follow-up.
