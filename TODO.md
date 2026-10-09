# TODO

Standing backlog — things agreed as worth doing, but not scheduled. Not a spec;
each item needs its own `spec.md` when it gets picked up.

Lifecycle: picking an item up leaves it here while the branch and `spec.md`
exist. The PR that finishes it deletes the item in the same change; `specs/` is
the record of what was built, this file is only what remains. An item that turns
out not worth doing is deleted too, with the reason in the commit message. If a
PR finishes only part of an item, trim the item to what is left.

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

## Performance

- **The site should feel instant.** Pages are 6 KB of HTML, yet first paint is
  1–2.5 s and every navigation re-downloads the scripts and fonts. Target: first
  paint under a second, in-site navigation indistinguishable from a static site.
  Specs with budgets and order exist on the `perf/*` branches; the first one
  holds the measured baseline.

- **The next page should be ready before you tap it.** Prefetch likely
  destinations on hover or touch-down so the puzzle appears the moment the card
  is pressed. Comes after the server work above, so a prefetched page is cheap
  and the server is measured before prefetch hides it.

## UI

- **Calendar touch-up.** The archives calendar and month strip need a visual
  pass.

- **A theme with more edge.** The design is clean but flat. Subtle noise or
  grain, soft gradients, a few geometric shapes as accents. The main theme stays
  modern; the others get to diverge on shape and texture once there are tokens
  for it.

- **A celebration that feels like a win.** Revamp the solve dialog: the wording
  (factual, never grading the play) and the celebration moment itself.

- **Smoother page changes.** View transitions between pages, opt-in per
  navigation. Needs the Fresh 2.3 upgrade first.

## Login

- **Logging in on a second device should bring that device's solves along.**
  Today the account keeps the first device's history and later devices'
  anonymous solves are left behind. Merge them when the device was anonymous at
  login. Specced on `feat/login-merge-history`.

## Tests

- **Playing a puzzle without JavaScript should be covered again.** The no-JS
  puzzle e2e scenario fails; probably portal related, not confirmed.
