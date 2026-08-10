# Generator curation loop, round 2

The generator produces boards faster than a curator can judge them. This round
attacks the judging half: what the curator has to do after each run, what
vocabulary they get for describing a board, and what the generator is asked to
aim at in the first place.

Five changes, all on `/puzzles/new`, plus the metrics behind them.

## Aim at a move count, not a difficulty

Picking a difficulty up front turned out to be the wrong question. `hard`
(10–13 moves) is effectively ungeneratable — under 3% of random layouts reach 10
moves, and the branchy ones exhaust the gate solver's state budget, so a hard run
just spins and gives up. Meanwhile the band gate let a `medium` request hand back
a 7-move board when a 9-move one was what made the session worthwhile.

So: no difficulty input. Each run picks a target move count from `MOVE_TARGETS`
(6–10) and the G2 gate demands exactly that, with **no fallback** — a run that
can't hit its target reports `exhausted` rather than quietly returning something
easier. The target is shown in the panel while the run is going and on the
result, so the curator always knows what was asked for.

Making the target exact also makes it cheaper: the gate solve now caps its depth
at the target, so a board needing more moves rejects on depth instead of being
solved in full only to fail the band check.

Difficulty becomes a *post-generation* judgement instead — the curator labels the
board after seeing it, seeded from the move count. Where their label disagrees
with the move count is the signal worth collecting; a number chosen before the
board existed never was.

## Judge the routes, not just the board

Previewing solutions is the most common thing to do after a run, and it meant
opening another tab. The panel now lists every distinct solution, weakest route
first; selecting one shows its score, its metrics and its character, and Watch
replays it on the board. The playable Preview button stays — it answers a
different question.

Picking a route plays it — watching is the first thing anyone does with a
selected solution, and the numbers only mean something next to the animation
that produced them. "Watch again" under the selection replays the same route.

That turned out to matter more than convenience. Watching the alternates has
repeatedly turned an interesting-looking board dull: the obvious route is the
one players find, and today it drags the whole board's score down with it,
because `compositeScore` mixes board-scope and route-scope metrics into every
route and `scoreBoard` averages the result. Four routes that are each good for
different reasons average out to something middling.

So curation splits in two, and the tooling now says which level it's talking
about:

- The **board** is judged on how it looks and sits — interesting, pretty,
  clumped, empty. The star rating stays here, puzzle-level and holistic, and
  stays the only rating: a pretty board with three great solutions and one
  boring one is a 4.
- A **route** is judged on how it plays: `too-easy` and `boring` against
  `interesting` and `unique`, stored per candidate under the route's encoded
  moves. `too-easy` is the important one and
  it belongs here, not on the board — the obvious route is the one players take,
  so a board whose easiest solution is trivial plays trivially however good the
  others are. Asked of a whole board the question was ambiguous (too easy by
  which route?), which is a fair explanation for why it never correlated; asked
  of one route it's a concrete claim, and it's the label a route-level score can
  be calibrated against. The two positives stay separate because they fail
  separately: `interesting` is about the route as an experience, `unique` about
  it being its own route rather than a reshuffle of another (the `birk` case —
  two solutions, one experience), which is what `puckPathVariety` measures.

The two vocabularies no longer overlap. Board tags are `clumped`,
`empty-areas`, `ugly` and `pretty`, each pointing at a board-scope metric that
tests it; `ugly` earns its place because most boards are neither ugly nor
pretty, and a tag that only marks the good ones leaves the bad and the
unremarkable indistinguishable. `meh` and `nice` were dropped as vague and
duplicated. Retired tags stay in the
files that carry them, including the old board-level `too-easy` labels: the
labelled store is calibration ground truth, so they round-trip rather than being
stripped on the next edit.

Every metric is tagged `board` or `route` scope in `METRIC_CATALOG`, and the
readout splits on it: board metrics stated once, route metrics showing the
selected solution — or their mean across routes when nothing is selected, since
the composite's max/min reduction answers a different question (what the best or
worst route offers) and shouldn't be read as the board's value.

Selection and replay live in the URL — `?solution=<i>&moves=…&mode=replay` —
the same contract the solution replay page renders under. Everything
measured at generation is written into the candidate's store file, so a
navigation costs nothing: the readout comes back from disk instead of a re-solve.

## Half stars

3.5 was being written into the note field over and over. Ratings now move in
half-star steps.

## Say what kind of board it is

Eighteen metrics answer "how good is this?" and nothing answers "what kind of
board is this?". `game/character.ts` derives two or three words from the metrics
— *wall-heavy*, *minimalist*, *reversal*, *false variety*, *slow start* — so two
candidates can be told apart without reading the table. Purely derived; nothing
stored, nothing gated.

## Four new metrics, advisory only

All four stay out of the composite and out of the gates until they earn a rating
correlation — same discipline `clumping` went through.

Two come from curation notes about how a board *plays*:

- **`openingSetup`** — moves before the puck first moves. The `henrik` note:
  *"puck starts blocked … adding a move or two just to get started"*. Occasionally
  the point, mostly padding.
- **`puckPathVariety`** — distinct puck trajectories ÷ distinct solutions. The
  `birk` case: two 9-move solutions that both move the puck exactly twice, along
  the same path, differing only in the order the blockers get shuffled. Reported
  as two solutions, experienced as one.

Two chase the board-level tags, which have far less measurement behind them than
the route side:

- **`emptyRegion`** — the largest connected run of cells with nothing in or
  against them. Aimed at `empty-areas`, the second most common complaint.
  `deadSpace` is the closest existing metric but measures cells no *trail*
  enters, which is play-derived; the complaint is about the layout you see
  before moving anything.
- **`wallSymmetry`** — share of walls with a mirror partner across the better
  centre axis. Aimed at `pretty`, the one board judgement with no metric at all.
  `boardSelfSymmetries` only catches exactly-invariant boards, which the
  probabilistic symmetry knob almost never produces; near-symmetry is what the
  eye rewards.

## Non-goals

- **Re-tuning or splitting the composite.** The scoring shape this round
  exposes — board terms and route terms mixed into one number — is worth
  fixing, but it needs the two-level labels this round starts collecting.
  `CALIBRATION` is untouched.
- **Post-generation mutation** — "keep this board but add walls without changing
  the move count", "add a blocker", "move the puck". The most promising direction
  for turning near-misses into keepers, and a separate unit of work: it needs a
  mutate-and-reverify loop, not a UI change. Next branch.
- Any change to how real puzzles are solved, scored, or served.

## Status

Done:

- New metrics `openingSetup` / `puckPathVariety` / `emptyRegion` /
  `wallSymmetry` in `scoring.ts` + `metric-catalog.ts`, all advisory
- `METRIC_CATALOG` entries carry a `scope`; `meanMetrics()` alongside
  `aggregateMetrics()`
- G2 gate switched from difficulty band to exact `targetMoves`, with the
  depth-capped gate solve; `MOVE_TARGETS` and `difficultyForMoves` exported
- `difficulty` removed from the generate request, its validation, and the
  `generator_options` cookie
- `game/character.ts` — derived character traits, shown for the selected route
- `StoredScoring` written into every candidate at generation: aggregate scores,
  board metrics, and each solution's moves, score and metrics
- Generator panel: no difficulty select, shows the run's move target, lists the
  solutions, per-route metrics/character/tags, Watch replays via the URL
- `/puzzles/new` derives `mode` and the selected solution from the URL
- Feedback island: half-star rating, curator difficulty, note saved while
  typing, save failures surfaced; `too-hard` reason tag removed (~40 labeled
  candidates, never once used)
- `/api/generated`: half-step rating validation, `difficulty` persisted,
  `action: "solution"` for per-route tags; retired reason tags still accepted so
  older candidates round-trip intact
- `list-generated`: half stars, half-step histogram, per-route tags
- `GENERATOR_VERSION` 0.7.0 — candidate distribution changed, so feedback
  buckets aren't comparable across it

The 71 candidates predating this round have no stored scoring; their readout
stays empty until they're regenerated, and nothing else about them changes.
