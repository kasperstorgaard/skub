# TODO

Standing backlog — things agreed as worth doing, but not scheduled. Not a spec;
each item needs its own `spec.md` when it gets picked up.

## Scoring

- **Revamp scoring now that we have better data.** Weight fitting was previously
  blocked on label count. That block is gone.

  Store as of 2026-09-03: **163 rated candidates**, of which **96 carry stored
  scoring, all at `calibrationVersion 5.0.0`** — one uniform, directly
  comparable fitting set. Route-level tagging has grown from 17 boards to **84
  boards / 282 tagged routes** (interesting 114, boring 72, too-easy 53, unique
  43).

  Last measured board-level fit is **ρ = 0.302 at n=119**
  (`scoring/reports/rating-separation-v5.0.0.md`, 2026-08-30). Not yet re-run at
  n=163 — `deno task check-calibration` needs ~15+ min when the solve cache is
  cold for new boards, so budget for it.

  **Preliminary route-level finding (2026-09-03, boards as the unit of analysis
  — sign test over per-board means, so it is not inflated by boards contributing
  many route pairs):**

  - The composite **separates `too-easy` from `interesting`** — on 10 of 11
    boards the too-easy route scores lower (p = 0.012). This confirms the
    earlier small-sample read at scale, and supports using `min` as a too-easy
    gate.
  - The composite **does not separate `boring` from `interesting`** — 44% of
    boards, p = 0.81. Dullness remains invisible to it.
  - Three metrics do show a consistent direction on `boring` routes, all _lower_
    than on interesting ones: `coverage` (20% of boards higher, p = 0.035),
    `deception` (17%, p = 0.039), `totalDistance` (24%, p = 0.049).
    **Suggestive, not conclusive** — n = 12–17 boards each, uncorrected for
    multiple comparisons, and right at the significance boundary. Worth
    designing a dullness term around, not worth trusting as a fitted weight.
    Note all three were dropped from the composite in v3 on _board-level_ ρ; the
    per-solution thesis predicts exactly this, that averaging over routes
    destroyed them.

  **Structural blocker found while measuring:** 13 of 23 metrics have **zero
  within-board variance** — `uniqueSolutions`, `wallUtilization`, `deadSpace`,
  `puckPathVariety`, `clumping`, `emptyRegion`, `wallSymmetry`,
  `firstMovePrecision`, `searchProfile`, `isolationGap`, `nearMissCount` are
  board-level values copied into every route's block. A per-route composite
  therefore has only ~10 real inputs, and per-route dead space genuinely does
  not exist yet. This makes the `unusedQuadrants` idea a prerequisite rather
  than a nice-to-have.

  Re-read the calibration history before re-weighting — several past conclusions
  were fit to a one-directional `too-easy` bias that the board/route tag split
  has since corrected.

## Game mechanics

New piece/tile types. All three change what the solver has to model, so each
needs `game/solver.ts` and the parser/serialiser to move together with the
renderer — and the generator's gates will need re-tuning once the search space
changes shape.

- **Tiling system.** Not yet scoped.

- **Portals.** Always exactly 2 per board. Entering one moves the piece to the
  other and it **continues with its existing momentum** (same direction, keeps
  sliding — it is not a stop). A piece standing on top of a portal **blocks the
  other side**, so an occupied pair is inert. Open: can a piece stop _on_ a
  portal (i.e. does it block only while at rest)? What happens when the exit is
  immediately walled?

- **Holes.** A piece that travels through one **disappears**. Removes the piece
  from play entirely. Open: is losing the puck an instant fail, or is it only
  blockers that can be lost? If the puck can vanish, the board becomes
  unsolvable mid-run and needs a fail/reset state the game does not currently
  have.

## UI

- **Re-add the solve count to the difficulty badge in the editor.** It was there
  before and got dropped.
