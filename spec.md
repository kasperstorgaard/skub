# Walls revamp

## Problem

Walls look drawn, not built. Each wall is a 3px border nudged onto one cell
(`BoardWall`), so it hugs that cell instead of sitting on the line between
cells, stops short where walls cross, and ends square. Walls that meet read as
separate strokes, not one shape.

## Approach

- **Merge walls into runs** (`game/wall-runs.ts`, pure). Each wall is one unit
  edge on the grid lines between cells; walls in a line merge into one straight
  run, through crossings. Each run end is _free_ (nothing else meets it) or
  _joined_ (it meets another wall at a corner).
- **Renderers draw each run as a 2px bar with slightly rounded
  ends (0.5px), mid-gap:**
  - Free ends stop at the tile edge, so they never reach into the next
    gutter.
  - Joined ends run half a stroke past the corner, so corners overlap and read
    as one shape with a rounded outside.
  - On the board each run is a positioned element placed with the same
    `--space-w`/`--gap` calc the pieces use, because the end offsets are in
    pixels and the cell size only exists in CSS (an SVG in grid units can't
    express them). Server-rendered, so no-JS play is unchanged.
  - The thumbnail (cards, og-image) draws the same runs as SVG rects with its
    own pixel sizes.
- Themes keep styling walls through `.board-walls` (sash's laser glow).

## Tests

Realistic shapes from the board: a lone wall, a straight run, an L, a closed
box, a cross, parallel walls on neighbouring lines, and a box with a wall
running off one side (a "d"), whose stem merges with the box's side into one
run.

## Non-goals

- No change to how walls are stored, parsed, edited or solved.
- No new wall look per theme beyond what the shape change brings.
