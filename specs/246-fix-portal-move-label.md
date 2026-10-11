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

**Name where the piece lands.** A guide is labelled "move to <x>,<y>" with the
move's destination, not the cell it is drawn to. For ordinary slides the two are
the same. The board still draws a portal guide only to the portal. Non-sighted
players learn where a portal move lands before choosing it, which sighted
players don't. Accepted: naming the outcome is the more useful label.

The e2e page objects already look guides up by destination. Two guides can
rarely land on the same cell; the click takes the first, since either leaves the
same board.

**One fixed portal scenario.** A no-JS solve of `ulla` covers portals every
day, not only on days the daily has them.
