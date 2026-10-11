# Portal move labels

## Problem

On a portal, a move guide is drawn only as far as the portal it goes in by, so
the board doesn't show where the piece comes out. Its accessible name used the
cell it was drawn to: a slide that lands on 1,5 through the portal at 1,2 was
announced as "move to 1,2". Screen readers heard the wrong destination, and the
e2e page objects, which look up the solver's destination by name, timed out.

The e2e flows that matter most solve the daily puzzle, so they failed on every
day whose puzzle has portals, and passed otherwise. That's the failing no-JS
scenario in `TODO.md`.

## Approach

**Name the destination and the portal.** A portal guide is labelled "move to
7,4, through portal at 2,0"; an ordinary one keeps "move to 0,7". The board
still draws the guide only to the portal. Non-sighted players learn where a
portal move lands before choosing it, which sighted players don't. Accepted:
playing a spatial puzzle without sight is an edge case, and naming the outcome
is the more useful label.

One function, `getMoveLabel(move)` in `game/guides.ts`, builds the label for
both the board and the e2e page objects. Hint guides carry their entry portal
like the others, so their labels match too.

**E2E knows about portals.** `solvePuzzle()` records the portal each
teleporting move goes in by, the way the board records it when the move is
played. Page objects find guides by `getMoveLabel`, and keyboard solving aims
for the portal entry.

**Portal coverage doesn't depend on the calendar.** The daily flows stay, since
the daily is the key feature. A fixed portal puzzle (`ulla`) is solved with and
without JS, so portals are tested every day, not only on portal days.

## Tests

- `game/guides_test.ts`: labels for an ordinary and a portal move; a portal
  hint carries its entry.
- e2e: two `ulla` scenarios in `routes/puzzles/[slug]/_e2e/puzzle_test.ts`; the
  daily flows pass again on portal days.
