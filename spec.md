# Puzzle scoring → gated generation + human curation

## Problem

We built a scoring composite (`game/scoring.ts`) to rank generated puzzles by
quality. Building the corpus report exposed that most of the metrics
(coverage, deception, isolation, variety, etc.) are **not simple, objective
indicators of quality** — they're proxies for a judgement that's inherently
subjective. The v1 calibration is squashed and inverted (see
`scoring/reports/calibration-1.md`): erik (easy) outscores torstein (hard).
Tuning the weights to fix one anchor pair tends to break another.

So we're **changing the role of scoring**. Instead of trusting a composite
number to accept/rank puzzles, we lean on:

1. **Gates** — cheap, defensible, mostly binary acceptance criteria — to reject
   the clearly-bad before a human ever sees it.
2. **A human** — the generator page becomes a curation surface: generate a
   gate-passing candidate, then hand-adjust.

The composite score is **demoted from gatekeeper to advisory** — a signal we
*show* the curator, not a filter that decides. But it is **not abandoned**: we
keep surfacing it so it stays tunable. The original goal — *picking the best
candidates, not merely gate-passing ones* — is still live; a well-tuned score is
also how we discover which future gates are worth promoting.

## Approach — phased

### Phase 1 (this PR): gated generation loop + board-quality gates

Make the generator page produce a candidate that **already passes all gates at
the requested difficulty**, so the human starts from something plausible instead
of pure random noise.

- **Generation loop.** Server-side, in `/api/generate`: repeatedly
  `generate()` → `checkGates()` until a board passes, or the budget is spent.
  Today the endpoint does a single unverified `generate()`; it moves to a
  gate-verified loop. `checkGates` needs `difficulty`, the existing-puzzle
  `corpus` hash set, and per-request `batchHashes` — the endpoint must load /
  accept these.

- **Gates are hard on generation, overridable when handcrafting.** During the
  generate loop, *every* gate is a hard reject — the loop never returns a
  board that fails one. But gates do **not** block manual editing: once a human
  is hand-adjusting a board in the editor, they can knowingly craft something
  that fails a gate. Gates constrain the machine; the human can override.

- **Difficulty control (new UI).** Add an easy/medium/hard selector to the
  generator panel. The loop gates the result against that band (G2). This
  widens the `/api/generate` request contract to carry `difficulty`.

- **Progress: a simple count.** The gated loop can burn many attempts (each runs
  the exhaustive solver, `maxDepth 15`), so don't block on a silent request —
  surface a **simple, increasing generation-attempt count** to the UI while it
  works, and keep a hard budget cap as a backstop so it can't run forever. No
  per-gate near-miss breakdown; just the count. Mechanism TBD — pick the
  lightest thing Fresh 2 supports cleanly (SSE / chunked / incremental).

- **Board-economy gates (new, hard).** Existing gates G1–G6 target the *solution*
  (solvable, minMoves band, dedup vs corpus, blockers matter, travel length).
  Add gates (G7+) that target **board economy** — clutter and wasted space.
  These are still *measured across the puzzle's solutions* (checkGates already
  has them), not from the static layout alone — they're board-quality in what
  they judge, not pre-solve:
  - **Wall utilization (G7)** — reject boards where too few of the interior walls
    ever stop a piece across the solutions (decorative clutter). (New
    `wallUtilization` signal; the memory noted it as diagnosed-not-implemented.)
  - **Dead space (G8)** — reject boards where too large a region is never entered
    by any trail and holds no piece/destination (wasted board). (New `deadSpace`
    signal.)
  - Candidate further gates: destination placement (not trivially cornered),
    blocker distribution. Exact signals + thresholds are TBD and tunable; land
    the clear-cut ones first.

  Thresholds are conservative — a gate should reject only the *clearly* bad and
  leave good/varied boards well clear, matching the existing G6 philosophy.
  Calibrated against the corpus: if a large share of hand-built puzzles fail a
  threshold, the threshold is wrong, not the puzzles.

  *Future:* genuinely static, pre-solve board gates (e.g. wall clustering / a
  slide-reachability flood-fill that needs no solutions) are desirable but not
  yet designed — the clean formulation isn't obvious (wall clustering especially).
  Deferred until we know how; the G7/G8 solution-derived economy gates stand in
  for now.

- **Surface the candidate's score (right-side panel).** Show the advisory
  composite + per-metric breakdown for the *just-generated* candidate in the
  generator's right side. It stays shown **until the first manual edit**, at
  which point it's dismissed/stale (the displayed score belonged to the
  generated board, and re-scoring on every hand-edit is Phase 3's job). This is
  deliberately in Phase 1, not deferred: seeing the score on every generated
  candidate is how we keep tuning the composite toward best-candidate selection
  and learn which signals deserve to become gates.

**Non-goals for Phase 1:** re-tuning the composite weights (the composite stays
advisory), and any auto-relaxing of constraints — if the loop can't find a
passing board within budget it stops and the human retries/loosens.

### Phase 2 (next): re-tune the composite toward best-candidate selection

Phase 1 already *shows* the generated candidate's score; Phase 2 acts on the
feedback that surfacing produces — re-calibrate the composite (weights / bounds)
against the ground-truth anchors so the number actually tracks quality, and
promote whichever advisory signals prove reliable into hard gates. This is the
path back to the original goal: *picking the best candidates, not just
gate-passing ones.*

### Phase 3 (future): micro-adjustment from a board

Instead of always generating from scratch, start from an existing (or
just-generated) board and make small local mutations — move a wall, add/remove a
blocker, nudge the destination — re-checking gates and score after each. A
guided-search / hill-climb curation mode rather than reroll-until-lucky.

Concretely, a **"Tweak" CTA** on a board that applies minor gated changes to the
*current* board (keeping most of it) rather than regenerating wholesale — the
lightweight, on-ramp version of the hill-climb idea.

### Future ideas (unscheduled)

- **Generation controls.** Surface the currently-hardcoded `GENERATE_OPTIONS`
  (walls range, blockers range, wall spread) as UI controls in the panel, so the
  curator can steer the candidate distribution before generating — not just the
  difficulty band.
- **"Intersection" / crossover.** Combine two boards semi-randomly into a new
  candidate (e.g. one random corpus puzzle × one freshly generated board), then
  run it through the gates. A genetic-crossover flavour of generation that could
  inherit structure from good hand-built puzzles.
- **Trim the editor CTAs.** The generator/editor panel has drifted toward a full
  file-manager (download, import). For the curation flow, collapse to just
  **Save** — drop Download/Import — so the panel reads as "generate → curate →
  save," not "manage files."
- **Dead-space / dead-wall overlay on the board.** Visualise what G7/G8 measure
  directly on the board — highlight the dead cells (no trail, no piece/goal) and
  the dead walls (never stop a piece) — so the curator sees *why* a candidate
  scores as it does and where to tweak, instead of reading it off a number.

## Status

- Done: corpus scoring, gates G1–G6, calibration v1 report (all landed on this
  branch, un-tuned).
- Done: G7 (wall utilization) + G8 (dead space) economy gates; gated generation
  loop in a worker with SSE progress + difficulty in `/api/generate`.
- Done: editor UI — difficulty selector, live attempt count, and the advisory
  candidate score in the right-side panel (hidden on first manual edit).
- G7/G8 thresholds calibrated against the 196-puzzle corpus (`deno task
  gate-corpus`): G8 `deadSpace <= 0.8` fails ~1%; G7 `wallUtilization >= 0.2`
  fails ~44% of hand-built puzzles — kept as-is intentionally, since generated
  candidates should be cleaner than the decorative-wall corpus average and manual
  editing bypasses gates anyway. Revisit once scores are surfaced (Phase 2).
- Scratch removed: `_tmp_genrate.ts`. The `tmp` commit is still in history —
  squash before merge.

## Ground-truth anchors

Calibration anchors for judging any scoring changes: **torstein ≳ malene ≫
erik > kim** (see the scoring-calibration-anchors memory).
