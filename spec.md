# Holes & Portals, part two

Stacked on `feat/portals-and-holes`, which added the two cells: the format, the
movement, the solver, the editor and the rendering. This branch targets that one,
not `main`.

Two things it left undone. A player meets a hole or a portal with no explanation
at all — and when a portal loop locks the board, the only thing telling them so
is the word "Stuck in a portal" on a disabled hint button. And the generator
cannot produce either cell, so every board carrying one has to be hand-authored.

## Telling the player

Two one-shot explanations, one per cell, shown the first time a player loads a
board that has one. Separate rather than combined: they are separate mechanics,
and a board rarely introduces both at once.

The tutorial's dialog is the wrong shape to reuse — it is a four-step guided tour
of `/puzzles/tutorial` driven entirely by URL state. What carries over is its
*pattern*, not its code: a `?dialog=` param picks the dialog, a second param
picks which of the two, and `islands/dialog.tsx` is the primitive underneath.

**Seen-ness lives in a cookie**, following `getHintCount`/`setHintCount` in
`game/cookies.ts` exactly: read in the route handler, written on a response.
Never localStorage.

The trick that keeps this simple: **the cookie is set on the very response that
shows the dialog.** No dismiss action, no client round-trip, and it works with
JavaScript off. Seeing it once is what marks it seen.

A board holding both, for a player who has met neither, chains them — the first
dialog's button is a plain link to the second, so the sequence survives without
JavaScript too. The second's cookie is set when its response renders, so a player
who never clicks through still gets told about portals on some later board.

Copy states what the cell does and stops. No grading, no congratulation — the
same rule the rest of the game's copy follows. The portal one has to cover the
loop, since that is the state a player cannot otherwise make sense of: the piece
circles, the board stops responding, undo is the way out.

Touches `game/cookies.ts`, `routes/puzzles/[slug]/index.tsx` (read the cookie,
decide which dialog is due), a new island for the dialogs, and
`islands/controls-panel.tsx` if the locked board deserves more than the hint
button's label.

## Letting the generator build them

**Off by default.** `generate()` with no new options must produce byte-identical
output to today — that is the acceptance test, not a nicety. The rated store and
the scoring composite were both measured on boards without these cells, and
boards with and without are not comparable, so the two populations have to stay
separable.

`GenerateOptions` gains a holes range and a portal-pair switch. Placement draws
from the same `pieceSpots` pool `generateBoard` already splices pieces and the
destination out of, which is what guarantees nothing lands on anything else —
the rule the board's own validation enforces.

`GENERATOR_VERSION` 0.7.0 → 0.8.0. Additive knobs, per the policy in its own
docstring; the default distribution does not move.

The knobs have to travel the whole path they already exist for: `GenOptions` in
`game/candidates.ts` so a candidate records what it was asked for, the cookie
round-trip in `game/cookies.ts`, validation in `routes/api/generate.ts`, and
controls in `islands/generator-panel.tsx`.

A new static gate rejects a board with exactly one portal. A lone portal is inert
by design so the editor can hold one mid-build, but it has no business shipping.

Reports partition on what a board actually holds rather than on what the
generator was asked for, so hand-authored boards sort correctly too:
`scoring/reports` and `scripts/check-calibration.ts` split the rated store into
boards with hazards and boards without, instead of averaging two populations into
one meaningless number.

## Verification

```bash
deno test -A game/ lib/ plugins/     # unit paths only; a full run has ~39 pre-existing e2e failures
deno fmt --check && deno lint
```

- `generate()` with default options produces the same boards as before the change
  — the property that keeps the existing calibration meaningful.
- A generated board with a portal pair solves, and its `minMoves` matches what
  can actually be played.
- Load a board with a hole for the first time: the dialog shows. Reload: it does
  not. Same for a portal.
- A board with both, to a player who has met neither, chains the two.
- Both flows again with JavaScript disabled.
- Walk into a portal loop and confirm the explanation makes the locked board
  legible without having read anything else.

## Not in this PR

- **`routes/api/solve.ts` has no piece-count cap.** It came from #225 on main and
  is unauthenticated: above 8 pieces the solver's state key exceeds
  `MAX_SAFE_INTEGER` and it returns a silently too-small `minMoves`, while each
  request spawns a worker that pre-allocates against the piece count. A real bug,
  but a different topic — its own branch.
- **A dropped piece in a *shared solution* replay** is covered; nothing outstanding.
- **Four untracked candidates** carry partial feedback (`elmer`, `elmer-d`,
  `elmer-e`, `tobias-b`) and are committed nowhere. `chore/rated-candidates` took
  the rated ones; these were out of its scope.
- **Theme legibility** for the two cells across all seven themes, plus print, has
  not been looked at by human eyes.
