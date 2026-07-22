# Make the generator nicer

## Problem

`fd139e5` landed the gated generator (`/puzzles/new`) with a single live knob
(difficulty) and an advisory score readout. The scoring spec
(`specs/210-feat-puzzle-scoring.md`) parked four follow-ups under "Future ideas":
surface the hardcoded generation controls, capture qualitative feedback on
candidates, persist candidates to disk, and use that labeled data to re-calibrate
the composite (Phase 2). This change delivers all four.

## Approach

Turn `/puzzles/new` from a one-knob reroll box into a **curation surface that
builds a labeled dataset** comparable against the hand-built corpus.

- **Generation controls (sidebar).** Surface the previously-hardcoded
  `wallsRange` / `blockersRange` / `wallSpread`, plus a **new symmetry knob** — a
  0–100% slider that mirrors a share of placed **walls** across both centre axes
  (0 = free-form, 100 = fully mirrored). Symmetry shapes wall *structure* only;
  blockers/puck/destination stay free. Because mirroring multiplies walls up to
  4×, the base wall count is scaled down by the expected expansion so the final
  symmetric layout stays within the requested range (otherwise high symmetry
  overcrowds the board into unsolvable, slow-to-solve messes). The four secondary
  knobs live behind a collapsed **Options** disclosure so the tight Panel stays
  usable.

- **Auto-naming.** Each generated candidate gets a random Nordic name
  (`game/nordic-names.json`) unused by any static or generated puzzle — matching
  the corpus convention of naming puzzles after people. Picked server-side on
  save (`game/names.ts` + `getCorpusNames`) and shown next to the board. When
  the pool runs dry, names get an ordinal suffix (`Hans-2`) instead of failing.
  Name and store filename are one thing: `Hans` lives in `generated/hans.md`
  (no synthetic ids), and the same slug flows through Edit/Save/Download.

- **Knob persistence ("persist on Generate").** `/api/generate` sets an
  httpOnly `generator_options` cookie with the knob values each run actually
  used; `/puzzles/new` reads it server-side (`getGeneratorOptions`,
  `game/cookies.ts`) so reloads reopen with the last-used settings — no client
  cookie/storage code, matching the app's server-set cookie convention.

- **Resume the newest candidate.** `/puzzles/new` always loads the newest
  stored candidate (board + name + any stored feedback) instead of an empty
  board — a dev reload mid-curation loses nothing; the empty board only appears
  when the store is empty.

- **Curation set tooling.** `deno task list-generated` prints the labeled store
  as a table (name, stars, reasons, difficulty, generator version) with a
  rated/unrated summary. `compare-generated` caches corpus scores per
  calibration version (`scoring/.cache/`, content-hashed per file), so reruns
  only pay for the candidates.

- **Feedback capture.** Each generated candidate can be rated **1–5 stars**;
  choosing a rating reveals **reason tags** (clumped, empty-areas, too-easy,
  too-hard, meh, pretty, nice). A free-text note is available from the start,
  unrated candidates included (curation showed notes carry the richest signal).

- **Generation performance.** The gate solve takes a tight `maxStates` budget
  (`game/solver.ts` gains a per-call cap; the worker passes ~2M) so a single
  branchy candidate rejects fast (G1) instead of grinding for seconds and
  freezing the progress count. The full 10M limit still applies to real solves.

- **Local storage (dev-only).** Every generated candidate is auto-saved to a
  gitignored `generated/` dir as markdown, with the feedback in frontmatter.
  Feedback edits patch the same file. Guarded by `isDev` like
  `routes/api/puzzles.ts` (Deno Deploy's filesystem is read-only). `generated/`
  is excluded from Vite's dev watcher (`vite.config.ts server.watch.ignored`) —
  otherwise each written candidate file triggers a full page reload that wipes
  the just-shown board back to the empty server state.

- **Cross-island state.** The board-adjacent feedback island and the sidebar
  panel share the current candidate via a module-singleton signal
  (`client/generator-signals.ts`), not a route-level prop signal.

- **Corpus comparison.** `deno task compare-generated` re-solves and scores the
  labeled candidates and the corpus, writing
  `scoring/reports/generated-vs-corpus.md`: per-metric distributions for corpus
  vs high-rated vs low-rated candidates, plus per-reason-tag means — the signal
  Phase 2 needs to re-calibrate the composite toward human judgement.

Scores are **not** embedded in the stored files; the compare script re-scores so
the report always reflects the current `CALIBRATION`.

## Calibration v2 (first pass on the labeled data)

The first 11 rated candidates independently replicated the anchor inversion:
under v1 a 2★ "too-easy" board scored highest of all boards, a 5★ lowest.
Calibration **v2** is a deliberately conservative, structural correction — only
changes both datasets support, no fitted constants, **gates untouched** (the
labeled set is too small to justify threshold moves):

- dropped `firstMovePrecision` from the composite (rewarded forced openings);
- promoted `wallUtilization` (positive) and `deadSpace` (negative) into the
  composite — the two strongest human-aligned signals;
- added a shaped `variety` term over distinct solutions (sweet band 2–8,
  neutral at 1, fading past 8 — a 49-route board rated "too-easy");
- generator symmetry default 0 → 0.5 (every 4–5★ board was generated at
  ≥ 0.55; four of five 2★ at 0).

`deno task check-anchors` measures each calibration against the ground truth
(anchor partial order + rated candidates): v2 flipped the pooled rank
correlation from negative to +0.30, deflating the too-easy profile (erik
0.42→0.19, the 2★ Thor 0.44→0.11). Residual known gap: single-route-brilliant
boards (torstein, Lauge) are underscored — needs the solution-isolation signal
(solving past optimal depth), deferred until the labeled set reaches ~50.

## Round 2: the 35-label batch → tooling + calibration v3

The store now holds **35 rated v0.5 candidates** (1×1★, 6×2★, 17×3★, 9×4★,
1×5★ — mid-heavy). Gates keep the floor clean; the problem is the top end:
dominant tags "too-easy" (18) and "clumped" (6), recurring notes about useless
blockers and decorative walls. Against this batch v2 collapsed: pooled
ρ = 0.066 (2★ boards near the top, four 4★ at the bottom).

- **Fast tuning loop.** The scoring worker now emits calibration-independent
  per-route metrics + bound context; `check-anchors` caches them
  content-hashed (`scoring/.cache/route-metrics.json`) and recomputes
  composites in-process (`compositeScore`/`BoundCtx` exported). A calibration
  iteration dropped from ~5 min of re-solving to seconds, and the report
  gained a **per-metric Spearman ρ vs rating** table — the evidence base for
  composite changes.
- **Calibration v3.** Pruned the composite to the metrics that track the 39
  labels: kept stopWeighted (+0.38), pieceUsage (+0.27), wallUtilization
  (+0.19), reversals (+0.18), searchProfile (+0.12), variety (corpus ground
  truth); dropped coverage (−0.22), crossTrailOverlap (−0.19), deception,
  totalDistance, setupRatio, and deadSpace-as-negative (G8 keeps it).
  Pooled ρ **0.066 → 0.197**.
- **Semver.** `GENERATOR_VERSION` ("0.5.0") and `CALIBRATION.version`
  ("3.0.0") are semver strings with bump policies documented at each
  definition; pre-semver forms ("0.5", 2) survive in stored candidates and
  report names.

**Known v3 trade-off:** the anchor sanity check regressed — erik (2★) now ties
malene (5★) and torstein (5★) sits below kim (1★) (v2 ordered them sensibly).
torstein's single-brilliant-isolated-route profile is exactly what no current
metric sees. v3 ranks the generated middle better while still missing what
makes the great boards great; the isolation signal below is the intended fix,
and anchors must be re-checked after it lands.

## Round 2 continued: generator fixes + advisory metrics (implemented)

1. **Generator fixes** (`GENERATOR_VERSION` → 0.6.0):
   - **Band-top minMoves preference**: the generation loop raises the G2 floor
     one move (via the new `minMovesFloor` gate option) for the first half of
     the attempt budget, then relaxes to the full band. Evidence: medium mM 9
     mean 3.44★ (4/9 ≥4★) vs mM 7 mean 2.95★ (4/19).
   - **Wall-floor top-up**: symmetry-expansion rounding + dropped duplicate
     reflections could land the final layout below `wallsRange[0]` (Stine 1★
     shipped that way); the generator now tops up — symmetrizing the extras so
     a fully symmetric layout stays flip-invariant.
   - **G9 trapped-blocker gate**: a blocker boxed in on all four sides by
     walls/edges reads as a wall in costume (Christoffer note). Static check,
     runs before the solve gates (gate numbers are historical; order is cost).
2. **Clumped metric** (advisory, calibration → 3.1.0): `clumping` — share of
   same-kind pairs (wall–wall, blocker–blocker) within Chebyshev distance 1.
   Not in the composite until its ρ earns it.
3. **Solution-isolation signal**: `bfsExplore` exhaustive mode gained opt-in
   `overshoot` — explores past the goal depth under the existing maxStates
   cap, truncating gracefully once the optimal window is complete (never
   weakening the G1 fast-reject below it); the DAG stays optimal-only, and
   `goalsPerDepth`/`searchedDepth` record suboptimal goal arrivals. New
   advisory metrics: `isolationGap` (moves past optimal to the nearest
   suboptimal goal state; window+1 when the window is clean, 0 = unmeasured)
   and `nearMissDensity` (suboptimal share of searched goal states). Used by
   the offline scoring worker and the generation winner's one-time advisory
   solve (never per-attempt, never gameplay). Measured cost: ~4–5× solve time
   (torstein 0.24 s → 1.0 s, malene 3.2 s → 14.5 s), paid once per board via
   the metrics cache. Note: goal *states* differ from canonical distinct
   solutions — torstein's state-level gap is 1 even though its next distinct
   solution is +2 — so the ρ table decides whether these earn composite entry.
4. All three surfaced in the generator panel's advisory details (clumping,
   isolation, near misses).

## Round 2 results (per-metric ρ on the rebuilt cache)

- **`clumping` ρ = −0.35 — second-strongest signal overall.** Promoted into
  the composite negatives → **calibration 4.0.0**; pooled ρ jumped
  **0.197 → 0.373**. The v4 table orders the extremes correctly (Vebjørn 5★
  top, Stine 1★ bottom, the 2★ boards pushed down); torstein remains the
  known hole.
- **`isolationGap` as first implemented is a dud**: every one of the 39 boards
  has gap 1 — some goal *state* always exists one past optimal (shuffle any
  blocker, then run an optimal route). State-level is too fine-grained.
- **`nearMissDensity` saturates** (0.89–1.00, ρ −0.11) for the same reason —
  and Spearman is monotone-invariant, so renormalizing can't fix it; it needs
  the same genuineness filtering as the gap.
- `compositeScore` now derives its value map from `Metrics` directly (a
  hand-maintained copy silently NaN'd the first v4 run).

## In progress: genuine near-miss isolation (solver side landed)

The fix for the flat isolation signal: count only *genuine* near-miss routes —
suboptimal routes that are not an optimal route padded with one inconsequential
extra move. Landed so far: `SolverResult.nearDag` (a second DAG over the
suboptimal goal states in the searched window; the primary `dag` stays
optimal-only) and `firstSolutionFrom(dag, goal)` to walk one route per goal
without materializing the combinatorial set.

Next session: in `game/scoring.ts`, replace `isolationGap`/`nearMissDensity`
with padded-aware versions — walk one route per `nearDag` goal at depth
minMoves+1, canonical-dedupe, drop routes where removing any single move
yields an optimal route's canonical multiset (`getCanonicalMoveKey`), count
the rest (`nearMissCount`; gap = 1 if any genuine, else 2). Then rename
plumbing (worker values, check-anchors `MAX_KEYS`, panel entry — the key
rename doubles as cache invalidation), rebuild the cache (~10 min background)
and read the ρ table again. Hypothesis to test: torstein/Vebjørn clean at +1,
"obvious" boards not.

## Still open

- Weighted composite terms once the labeled set grows (~100 labels = weight
  fitting; ~45–50 = detect ρ 0.3 effects; currently 39).
- Rate a ~15–20 corpus slice for cross-band ground truth (the 4 anchors are a
  tripwire, not a target; the unrated 207-board corpus only serves as a
  distribution reference and G3 novelty source until it has ratings).
- Half-star ratings in the feedback UI — the curator already writes "3.5" in
  notes; the star widget rounds that information away.

## Non-goals

Gate-threshold changes (the floor is already clean — quality shaping belongs
in the composite and generator); promotion tooling for `generated/` →
`static/puzzles/` (manual by design); any in-app corpus-comparison panel
(offline report only).
