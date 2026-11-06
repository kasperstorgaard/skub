# Walls revamp

## Problem

Walls look drawn, not built. Each wall is a 3px border nudged onto one cell
(`BoardWall`), so it hugs that cell instead of sitting on the line between
cells, stops short where walls cross, and ends square. Walls that meet read as
separate strokes, not one shape.

## Approach

- **Trace walls into paths** (`game/wall-paths.ts`, pure). Each wall is one
  unit edge on the grid lines between cells. Connected edges are walked into as
  few paths as possible, going straight on through crossings where it can, and
  a run that comes back to its start closes with `Z` so every corner joins. Path
  data is in grid units: line `k` sits at `k`.
- **One SVG per board draws them**, with round caps and joins:
  - The board overlays an SVG on the grid, offset by half the gap so grid line
    `k` lands mid-gap. `vector-effect: non-scaling-stroke` keeps the stroke 3px
    whatever the board's size. Server-rendered, so no-JS play is unchanged.
  - The thumbnail (cards, og-image) maps the same path data with a transform
    and a stroke width divided by the scale, so it needs nothing an SVG
    rasteriser might lack.
- Themes keep styling walls through `.board-wall` (sash's laser glow).

## Tests

Realistic shapes from the board: a lone wall, a straight run, an L, a closed
box, a cross, and a box with a wall running off one side (a "d"), which traces
as one path through the junction.

## Non-goals

- No change to how walls are stored, parsed, edited or solved.
- No new wall look per theme beyond what the shape change brings.
