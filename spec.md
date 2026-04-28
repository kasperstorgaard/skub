# Back arrow & celebration exit: split today vs archived

## Problem

The back arrow on every puzzle page hardcodes `href="/"`, and the
CelebrationDialog has a hardcoded "Home" tertiary link. For archived puzzles
this is wrong twice: players exploring the archive get bounced to the home page
both via the header back arrow and via the dialog after solving. Worse, the
archive landing page lands on *today* rather than the day they were browsing —
re-finding their place is friction every time.

## Approach

Compute a single "back" target on the puzzle page and pass it to both the
header and the CelebrationDialog:

- `puzzle.number === getDayOfYear(today)` → `{ href: "/", label: "Home" }`
- otherwise (archived) → `{ href: "/puzzles?date=YYYY-MM-DD", label: "Archives" }`
  where the date is the puzzle's release date (year of `createdAt` + day-of-year
  from `number`). The archive page already reads `?date=YYYY-MM-DD` via
  `getArchiveDate`, so it lands on the correct calendar day.
- no `number` (tutorial / onboarding entries) → `{ href: "/", label: "Home" }`

`getPuzzleArchiveHref(puzzle)` lives in `game/url.ts` next to `getArchiveDate`,
so the read and write sides of the date param sit together. Returns `null` when
the puzzle has no `number`.

CelebrationDialog accepts an optional `back` prop (`{ href, label }`) and
defaults to `Home` / `/` for any caller that doesn't pass one — the puzzle page
is currently the only consumer.

## Non-goals

- "True" back navigation (remembering which archive month/filter the user came
  from beyond the day). The day-precision URL is enough for the intended UX.
- Back arrow split for solutions / og-image / clone subroutes — only the
  puzzle detail page is affected.
- Touching SolutionDialog — its dismissal path is structurally different
  (name-entry flow, not a tertiary "leave" link).
