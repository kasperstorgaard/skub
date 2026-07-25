# Make the generator nicer

## Problem

`fd139e5` landed a gated generator at `/puzzles/new` with a single live knob and
an advisory score. Two things were missing: the generator produced boards a
curator mostly rejected, and there was no way to say *why* — so the scoring
composite had nothing to be tuned against. Its own calibration report showed it
was **anti-correlated** with human judgement.

## Approach

Turn `/puzzles/new` into a curation surface that builds a labeled dataset, then
use that dataset to fix the generator and the score.

### Generator

- **Symmetry knob** (0–100%) mirrors a share of placed walls across both centre
  axes. Because mirroring multiplies walls up to 4×, the base count is scaled
  down by the expected expansion and topped up if rounding lands under the
  requested floor — otherwise high symmetry overcrowds the board into unsolvable
  messes. Symmetry shapes wall *structure* only; pieces stay free.
- **The remaining generation controls** (walls, blockers, spread) are surfaced
  behind an Options disclosure, and persist via an httpOnly cookie written on
  each Generate — so idle slider twiddling never sticks.
- **Auto-naming** from a Nordic name pool, matching the corpus convention.
  Name and filename are one thing: `Hans` lives in `generated/hans.md`.
- **Faster rejection.** The gate solve takes a tight `maxStates` budget so a
  branchy candidate rejects fast instead of grinding for seconds.

### Curation

- Every generated candidate auto-saves to `generated/` as markdown. It can be
  rated 1–5 stars with reason tags and a free-text note, all patched into the
  same file. The page resumes the newest candidate on load, so a dev reload
  mid-curation loses nothing.
- The store is **tracked in git**: those ratings are the ground truth every
  calibration decision rests on, and the tuning tools are useless without them.
- Writing is dev-only (`isDev`), since Deno Deploy's filesystem is read-only.

### Scoring

Calibration moved v1 → v5, each step justified by the labeled set and reported
by `deno task check-anchors`. The full rationale for what entered and left the
composite lives in the `CALIBRATION` doc comment in `game/scoring.ts`, which is
where it stays current; the short version is that the composite was pruned to
the metrics that actually track ratings, `clumping` was promoted after coming
out the second-strongest signal, and `variety` was dropped. Pooled Spearman ρ
went from negative to **+0.49**.

Three gates changed, all grounded in the labeled data: **G9** rejects blockers
walled in on all four sides (a wall in costume), **G10** rejects egregious
clutter, and **G5/G7** now scale with the board's realized counts so a request
for a dense board isn't mechanically over-rejected.

### Tooling

`scripts/lib/` holds the shared machinery: one worker that solves a board in an
isolated subprocess, and one content-hashed cache. That cache stores only
calibration-*independent* output, so composites are recomputed in-process and a
calibration change never forces a re-solve — tuning iterations cost seconds
instead of half an hour.

On top of it: `check-anchors` (does the composite track human judgement?),
`compare-generated` (which metrics separate kept boards from rejected ones?),
`score-corpus` (per-puzzle report and outliers), and `list-generated` (what's in
the store). `game/metric-catalog.ts` is the single declaration of every metric's
label, tooltip and aggregation direction, so the panel readout, the reports and
the calibration tooling cannot drift apart — a hand-maintained copy silently
NaN'd a whole calibration run before it existed.

## Known gaps

- **The isolation metrics are advisory and earn nothing yet.** `isolationGap`
  and `nearMissCount` correctly identify the isolated-brilliant profile, but
  neither earns linear composite entry: quality is non-monotonic in near-miss
  count, and an isolated-brilliant board reads identically to an
  isolated-trivial one. They stay advisory until a difficulty-gated term is
  designed around them. The solver's `overshoot` mode that feeds them is off by
  default, so gameplay and the generation gates pay nothing for it.
- **The rating rubric has a one-directional bias.** Across 43 labeled boards
  there are 19 `too-easy` tags and zero `too-hard`, so every calibration was fit
  to a signal that only pushes one way. Whether "easy but interesting" is good
  product — and whether the curated difficulty label should exist at all — is an
  open question, deliberately not resolved here.
- Weighted composite terms need ~100 labels; there are 43.
- Half-star ratings: the curator writes "3.5" in notes and the widget rounds it
  away.

## Non-goals

Gate changes as *quality* shaping — the gates stay a structural floor, and the
composite does the shaping. Promotion tooling for `generated/` →
`static/puzzles/` (manual by design). Any in-app corpus-comparison panel; the
reports are offline.
