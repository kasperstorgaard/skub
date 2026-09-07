# Tiles

## The problem

Board generation scatters walls and blockers at random within zones, then gates
the result on an exact move count. It produces solvable boards, but nothing about
the layout is *authored* — whether a board looks good is an accident that the
composite score then tries to detect after the fact. That is backwards, and it is
the same tension the calibration work keeps running into: a board can be pretty
and too easy, or fair and dull, and no metric settles it as well as a person
looking at it.

## The approach

Take the model from the tabletop game. Ricochet Robots builds its 16x16 board
from four 8x8 quadrant tiles that get rotated and combined; this does the same at
4x4 into our existing 8x8 board. Tiles are hand-authored — walls, up to three
blockers, optional holes and portals — and live in `static/tiles/` as markdown,
the same way puzzles do.

Generation then becomes three deliberate steps instead of a search loop:

1. **Deal** four tiles matching a configuration — a category pattern like `AAPP`,
   or looser constraints (portals or not, holes or not), plus how many *distinct*
   tiles to draw on. Four is all unique; one is the same tile in every quadrant,
   turned differently in each. Fewer distinct tiles is how a board comes out
   symmetric, which the tabletop version gets from its four-quadrant layout and
   which is worth being able to ask for.
2. **Arrange** them by hand: rotate, flip, or swap any tile, transform the whole
   board, reshuffle, or edit individual cells. This is where a board becomes
   worth playing, and it is a human judgement.
3. **Roll** puck and destination, the way the physical game rolls two dice.
   Re-roll freely, or place either by hand.

The order matters more than the mechanism: **layout is judged by a person before
difficulty is measured by the machine**. Step 3's output is already a candidate,
so it hands straight to the existing review-and-promote flow.

Tiles carry a category letter that the editor derives from the tile itself: `A`
simple, `B` cluttered, `P` one portal, `X` holes, `Z` both. Deriving it means a
tile can't be filed under a letter its contents contradict, which matters because
dealing selects by letter. A tile can be reworked afterwards: editing replaces it
in place and keeps its number, so `B7` stays the tile it was. Because a tile may
never carry a wall on its own edge, tiles combine in any rotation without seams
needing special handling — and because `P`/`Z` tiles hold exactly one portal
each, dealing them in pairs is what keeps a board's portal count at 0 or 2.

## Later

While arranging, there is no signal at all about how hard the board is likely to
be — the solver only has something to say once puck and destination are down.
Cheap computed stats, updated after each arrange action, would give a sense of
that earlier.

Lanes don't transfer to this: a lane is a 4-wide run within one tile, while a
board-level straight run crosses two of them, so it measures something else.
What the per-board metrics should be is still open — the promising direction is
heatmaps rather than single numbers, since where a board is dead or busy is
spatial and a person reading the board can act on it. Which quantities to shade
is the open part. Not in this change.

## Non-goals

- **The solver and the scoring engine are untouched.** They still measure every
  board this produces; only the way boards come into existence changes. The
  planned recalibration toward per-solution scoring is separate work, and a
  larger corpus of tile-composed boards should make it easier, not redundant.
- **No automatic quality gate on layout.** Gates stay an advisory readout. A gate
  rejecting a board a person composed on purpose indicts the gate.
- **No new curation surface.** Review, rating, and promotion are as they were.
