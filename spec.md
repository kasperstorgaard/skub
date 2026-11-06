# Walls revamp

## Problem

Walls look drawn, not built. Each wall is a 3px border nudged onto one cell
(`BoardWall`), so it hugs that cell instead of sitting on the line between
cells, stops short where walls cross, and ends square. Walls that meet read as
separate strokes, not one shape.

## Approach

- **Shape the walls** (`game/wall-runs.ts`, pure). Each wall is one unit edge
  on the grid lines between cells. Walls in a line merge into one straight run,
  through crossings; a grid point where exactly two walls turn a corner is a
  _bend_. Each run end is _free_ (nothing meets it), _bent_ (it turns into a
  bend) or _joined_ (it meets a wall that carries on, a T).
- **Draw them 2px, mid-gap:**
  - Free ends stop at the tile edge, so they never reach into the next gutter,
    and are only slightly rounded (`--wall-radius`, 0.5px).
  - Bends are quarter arcs with a 3px outer radius, softer than the ends.
  - Joined ends run half a stroke past the T's crossbar, hidden under it.
  - On the board each run and bend is a grid item, placed by row/column like
    the cells. A run spans the cells it borders with its edge pulled onto the
    line mid-gap, so a free end lands on the tile edge with no offset; joined
    and bent ends reach on with a negative margin. A bend is a 3px box in the
    cell at its corner with two borders and one rounded corner. No position
    maths, server-rendered, so no-JS play is unchanged.
  - The thumbnail (cards, og-image) draws the same shapes as SVG with plain
    numeric attributes, since crawlers rasterise the og-image SVG.
- Themes keep styling walls through `.board-wall` (sash's laser glow).

## Tests

Realistic shapes from the board: a lone wall, a straight run, an L, a closed
box, a cross, parallel walls on neighbouring lines, and a box with a wall
running off one side (a "d"), whose stem merges with the box's side into one
run and meets the top in a T; plus the arc for a bend each way round.

## Non-goals

- No change to how walls are stored, parsed, edited or solved.
- No new wall look per theme beyond what the shape change brings.
