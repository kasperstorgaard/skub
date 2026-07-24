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

## Genuine near-miss isolation (landed)

The fix for the flat isolation signal: count only *genuine* near-miss routes —
suboptimal routes that are not an optimal route padded with one inconsequential
extra move. Solver side (earlier): `SolverResult.nearDag` (a second DAG over the
suboptimal goal states in the searched window; the primary `dag` stays
optimal-only) and `firstSolutionFrom(dag, goal)` to walk one route per goal
without materializing the combinatorial set.

Scoring side (this session): `game/scoring.ts` `genuineNearMisses(result,
optimalSolutions)` replaces the dud `isolationGap`/`nearMissDensity`. It walks
one route per `nearDag` goal at depth minMoves+1, canonical-dedupes
(`getCanonicalMoveKey`), and drops *padded* routes — those where removing a
single move yields an optimal route's canonical multiset. Returns `count`
(genuine +1 near-misses) and `gap` (1 if any genuine, else 2; 0 unmeasured).
`Metrics` now carries `isolationGap` (= gap) and `nearMissCount` (= count,
renamed from `nearMissDensity`). Plumbing renamed across `computeMetrics`,
`scoreBoard`, `routeMetrics`, compare-generated `METRICS`/worker values,
check-anchors `MAX_KEYS`, and the generator panel; the `nearMissCount` rename
doubles as cache invalidation. Unit test in `scoring_test.ts` builds a synthetic
`nearDag` (one genuine + one padded route) and asserts count/gap. All advisory
still — not in the composite until the ρ table earns it.

Outcome (ρ re-read, check-anchors 39 boards): the fix is *correct* — torstein
reads `isolationGap=2` (isolated at +1) and malene `nearMissCount=25` (varied),
both 5★, both now measured right. But **neither earns linear composite entry**
(isolationGap ρ −0.02, nearMissCount ρ −0.10): quality is non-monotonic in
near-miss count, and `gap=2` conflates isolated-brilliant (torstein) with
isolated-trivial (kim). The behaviour-informed calibration pass that followed is
the v5 section below (it dropped `variety`); the isolation signals stay advisory
until a difficulty-gated / U-shaped term is designed around them.

## Behavioural corpus data (PostHog, this session)

Pulled per-corpus-board behaviour from PostHog `puzzle_solved` events as a third,
*difficulty* axis (not quality — behaviour ≠ curated quality; malene is 5★ yet
behaves easy). Artifacts in `scoring/.cache/` (gitignored, regenerable): raw
`.psv` pulls, `behavioral.json` (slug-keyed clean cache), and reports
(`behavioral-too-easy-*`, `behavioral-mislabel-*`, `behavioral-tripwire-*`,
`behavioral-metric-correlation-*`). Generator scripts are in session scratchpad,
not committed — promote to a `deno task` if we want reproducibility.

Key findings (full detail in the `scoring-calibration-anchors` memory):
- Only usable signal is **player-adjusted optimal-solve rate** (`optAdj`)
  + `ratioAdj` — player fixed-effects (board vs its own players' baseline on
  *other* boards). solve-rate (cookie/consent asymmetry) and hints (historical
  bots, since Cloudflare-fixed) are unusable.
- De-confounded difficulty tracks the labels (median behav-pctile easy 33 /
  medium 48 / hard 80; partialling out `minMoves` leaves ρ −0.24, so it carries
  signal beyond board length) → a **difficulty mislabel review** shortlist.
  Section sizes are percentile cuts and are populated by construction — the
  length of a list is not evidence of that many mislabels. Blind spot:
  underrates isolated-brilliant-optimal boards (torstein, `optAdj` +1.0).

## Behavioural adjustment: dilution fix (landed)

The first cut of the adjustment gave solves by single-board players a difference
of 0 and **kept them in the average**, which scaled every board's signal by its
share of linkable solves (10%–70% across the corpus). Verified as an identity on
40 boards: reported ≈ true × linkable-share, mean error 0.71 pp. That is the
traffic-mix confound the adjustment exists to remove, reintroduced through the
denominator — and it hit hardest exactly where it mattered, on the high-traffic
entry boards. `alf` (91.5% optimal, the corpus's most trivially-solved board)
scored an unremarkable +7.1; `karla` +3.1 was written up as proof the method
worked.

Now `deno task behavioral-reports` (promoted out of session scratchpad, SQL
documented in the script): leave-board-out baseline over linkable solves only,
`feN` recorded per board, and empirical-Bayes shrinkage so a board resting on 9
solves is not ranked against one resting on 118. Reports print `feN` alongside
`solves`. Shortlist churn vs the buggy version: 16/20 kept on the too-easy list,
15/24 on the mislabel list.

**Interpretation limit (curator, 2026-07-24): anonymous sessions are allowed, so
returning players are frequently issued a fresh `person_id`.** The 236 linkable
ids are therefore *ids that happened to persist*, not "regulars" — the excluded
mass mixes genuine newcomers with returning players (it solves optimally 41.1% vs
33.7% for linkable ids, the wrong way round for a newcomer pool). Consequences:
- The signal is still a valid within-id comparison and reliable at the board
  level (78% of the observed spread is true between-board variance; player-split
  reliability 0.66, Spearman-Brown ≈ 0.79).
- It has no defensible population coverage → **review shortlist, never an
  autorelabel**.
- Replay inflation was the obvious worry and is ruled out: repeat solves of the
  same board are *less* optimal, not more (36.1% → 36.0% → 30.3% → 19.6% by
  attempt), so the too-easy list is not a replay artifact.
- Per-player learning drift cannot be measured at all — fragmented histories look
  flat by construction. Any future claim resting on player tenure needs a
  stable identifier first.
- **Tier-1 metric correlation** (n=198, only the stale-v2 partial corpus cache
  available): `uniqueSolutions`/variety tracks behavioural easiness (ρ +0.16 on
  the corrected signal, was +0.195 on the diluted one — the dilution fix barely
  moves Tier 1, since it preserves rank order at ρ 0.98) → the one too-easy lever
  surfaced so far. Worth noting `variety` also earns nothing on the quality axis
  (ρ −0.03 vs the 39 ratings), so both axes now point the same way on tempering
  it. The composite's strong members
  (stopWeighted/pieceUsage/clumping/searchProfile) aren't in any corpus cache →
  **Tier 2 needs the full corpus re-solve** (`corpus-scores-v4.0.0.json`, now
  regenerating) before a behaviour-driven calibration bump is justified.

New corpus uses this unlocks: (1) control for difficulty when correlating metrics
vs quality (partial correlations separate length-trackers from quality-trackers);
(2) a within-corpus separation tripwire (composite should rank the behavioural
fillers below the rest); (3) a real-play regression set for the too-easy failure
mode; (4) a nominator for scarce low-end quality labels (confirm by hand).

## Calibration v5.0.0: drop `variety` (landed)

Tier 2 finished (full corpus re-solve → `corpus-scores-v4.0.0.json`, n=192).
Correlated against the corrected shrunk behavioural signal (`optAdjShrunk` /
`ratioAdjShrunk`): the composite's strong members (`stopWeighted` −0.28,
`reversals` −0.24, `searchProfile` −0.21, `pieceUsage` −0.17 vs easiness) all
track *difficulty* — pulling the right way. `uniqueSolutions`/`variety` is the
lone composite positive that tracks *easiness* (ρ +0.18) — and its quality ρ is
≈ 0 (39 ratings). The v4 composite `score` is ~orthogonal to easiness (−0.02).

So `variety` was a positive that rewarded easy multi-solution boards, earned
nothing on quality, and *penalised* the isolated-brilliant profile (torstein,
few solutions). Dropping it (removed the CALIBRATION term + the now-dead
`varietyScore`/`values.variety`): **pooled ρ 0.373 → 0.488** and the anchor order
is restored (malene 0.556 ≈ torstein 0.468 ≫ erik 0.422 > kim 0.385 — the v3/v4
tripwire regression, fixed). Major bump (composite membership) → cache re-keys to
`corpus-scores-v5.0.0.json` (next `compare-generated` re-solves, ~30 min).

Quality is non-monotonic in solution count (varied-malene *and* isolated-torstein
both 5★), so the varied side wants a **difficulty-gated / U-shaped** term, not a
naive "more solutions = better". Raw material: `nearMissCount` / `isolationGap`
(genuine near-miss isolation, now landed but advisory — neither earns linear
composite entry: `gap=2` conflates isolated-brilliant torstein with
isolated-trivial kim, so isolation must be gated by difficulty — where the
behavioural signal earns its keep). Deferred until such a term is designed.

## Still open

- **Incorporate the corpus as weak labels** (curator-stated prior,
  2026-07-22: shipped corpus boards are nearly all 3★+, mostly 4★, some 5★ —
  1–2★ are rare outliers like the kim/erik anchors; and the only *generated*
  puzzles ever promoted to the corpus were rated 4–5★, some after hand
  adjustments). That makes the 207-board corpus usable beyond a distribution
  reference / G3 novelty source:
  - a separation tripwire alongside ρ: the corpus (as a weak ≥3★ class)
    should collectively outscore the low-rated generated candidates — cheap,
    uses all 207 boards, no rating sitting needed;
  - promotion status is itself a label: promoted generated boards are
    known 4–5★;
  - exact labels still come from rating a ~15–20 corpus slice (espec. the
    tails — the handful of boards the curator considers fillers or
    masterpieces), which also anchors the scale across difficulty bands;
  - **PostHog solve tracking** (curator offer, 2026-07-22): pull per-puzzle
    behavioural data for the shipped corpus — e.g. solve/abandon rates,
    attempts, solve time, player moves vs `minMoves` — as another label
    source. Behavioural difficulty ≠ curated quality (a pretty 4★ can be
    easy; a grindy board can be unfun), so treat it as a third signal to
    correlate against the metrics, not a replacement for ratings.
- Weighted composite terms once the labeled set grows (~100 labels = weight
  fitting; ~45–50 = detect ρ 0.3 effects; currently 39).
- Half-star ratings in the feedback UI — the curator already writes "3.5" in
  notes; the star widget rounds that information away.

## Non-goals

Gate-threshold changes (the floor is already clean — quality shaping belongs
in the composite and generator); promotion tooling for `generated/` →
`static/puzzles/` (manual by design); any in-app corpus-comparison panel
(offline report only).
