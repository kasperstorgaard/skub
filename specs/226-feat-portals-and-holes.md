# Holes & Portals

Skub's board has one verb: slide until something stops you. Walls, blockers and
edges are three spellings of the same idea — a hard stop at the end of a slide.
This adds two cells that change what happens *during* a slide instead.

- **Hole** — anything entering it drops off the board and is gone. The puck can
  fall in; play continues, but that board can no longer be won.
- **Portal** — always a pair. Entering one emerges from the other, carrying its
  momentum in the same direction.

Both sit on the grid like pieces do, so a wall can share their cell.

This is a deliberate expansion of the core mechanic rather than an accident of
one. The game's complexity budget is supposed to stay small, so the bar for the
two new cells is that each is one sentence to explain and visible on the board.

## Mechanics

A slide resolves cell by cell from the origin:

1. **Wall, piece or edge** — stop on the last free cell. Unchanged.
2. **Hole** — the piece enters and is removed; the hole is the move's endpoint.
3. **Portal** — the piece emerges at the paired portal and keeps going. If the
   cell beyond the exit is blocked it stops on the exit portal; if the exit
   portal is occupied it stops on the entry portal.
4. **Portal loop** — re-entering a portal already used in the same slide. The
   piece never comes to rest: it cycles between the two portals, the board stops
   accepting input, and undo (or reset) is the only way out. Nothing is
   destroyed — backing out restores the position exactly.

A lone portal, which the editor can hold mid-build, is inert.

A hole and a loop are different failure shapes on purpose. A hole is a permanent
consequence you keep playing with; a loop is a trap you reverse.

## Approach

Sliding is currently implemented three times — for play, for the solver, and for
scoring's metrics — and none of the three walk the board. They each clamp inward
from the edge, which is fast and correct for hard stops but has no notion of the
cells crossed on the way. A hole or a portal cannot be expressed as a clamp, so
play and scoring move onto one shared ray-walk, and the solver keeps its own
tuned copy behind a fast path: a board with no holes and no portals runs exactly
today's clamp loop and solves identically, at identical speed.

The solver packs each state as one byte per piece, so a hole removing a blocker
would break its fixed stride. A sentinel position means "gone" instead, keeping
the piece count constant. Moves that are provably dead — dropping the puck, or
walking into a loop — are simply never emitted; a player may still make both.
That asymmetry is intended, not a disagreement between the engines.

Guides stop at the portal. Where a portal comes out is left for the player to
work out, loops included, so a trap looks like any other portal entry until you
try it. That withholds no information: both portals are on the board and the
rule is deterministic.

Being stuck in a loop is derived from the move list, never stored, because moves
live in the URL — a reloaded or shared stuck link has to come back stuck, with
or without JavaScript. The trapped piece is shown circling the two portals, and
the hint refuses a board it cannot advance rather than failing on it.

One thing a hole forces that nothing did before: a piece can leave the board.
Identity could previously be a piece's slot in the board's list, since that list
only ever changed in place. Removing a piece shifts every later slot, so pieces
now carry an identity pinned to where they started — without it a renderer
keying on position hands one piece's element to another and animates the wrong
one.

## Non-goals

- **Generation.** The generator is untouched here. The rated store and the
  scoring composite were both measured on boards without these cells, and the
  two populations aren't comparable, so generated holes and portals come later
  behind an opt-in knob with the mechanics recorded on each candidate.
- **New scoring metrics.** Only enough scoring work to keep existing metrics
  correct. Boards without holes or portals score bit-identically, so the
  calibration version does not move.
- **Onboarding.** The first-time explanation dialogs land in the stacked PR that
  follows this one.
