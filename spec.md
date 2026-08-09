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

## Preview the solutions in place

Previewing solutions is the most common thing to do after a run, and it meant
opening another tab. The panel now lists one button per distinct solution and
replays it on the board in place. Multiple solutions are the point: a board is
only as good as its *weakest* interesting route, and the only way to know is to
watch them. The playable Preview button stays — it answers a different question.

## Half stars

3.5 was being written into the note field over and over. Ratings now move in
half-star steps.

## Say what kind of board it is

Eighteen metrics answer "how good is this?" and nothing answers "what kind of
board is this?". `game/character.ts` derives two or three words from the metrics
— *wall-heavy*, *minimalist*, *reversal*, *false variety*, *slow start* — so two
candidates can be told apart without reading the table. Purely derived; nothing
stored, nothing gated.

## Two new metrics, advisory only

Both come straight from curation notes, and both stay out of the composite and
out of the gates until they earn a rating correlation — same discipline
`clumping` went through.

- **`openingSetup`** — moves before the puck first moves. The `henrik` note:
  *"puck starts blocked … adding a move or two just to get started"*. Occasionally
  the point, mostly padding.
- **`puckPathVariety`** — distinct puck trajectories ÷ distinct solutions. The
  `birk` case: two 9-move solutions that both move the puck exactly twice, along
  the same path, differing only in the order the blockers get shuffled. Reported
  as two solutions, experienced as one.

## Non-goals

- **Post-generation mutation** — "keep this board but add walls without changing
  the move count", "add a blocker", "move the puck". The most promising direction
  for turning near-misses into keepers, and a separate unit of work: it needs a
  mutate-and-reverify loop, not a UI change. Next branch.
- Re-tuning the composite. New metrics are advisory; `CALIBRATION` is untouched.
- Any change to how real puzzles are solved, scored, or served.

## Status

Done:

- New metrics `openingSetup` / `puckPathVariety` in `scoring.ts` +
  `metric-catalog.ts`
- G2 gate switched from difficulty band to exact `targetMoves`, with the
  depth-capped gate solve; `MOVE_TARGETS` and `difficultyForMoves` exported
- `difficulty` removed from the generate request, its validation, and the
  `generator_options` cookie
- `game/character.ts` — derived board-character traits
- `generated.ts`: half-star `rating`, curator `difficulty` on `Feedback`,
  `too-hard` reason tag removed (~40 labeled candidates, never once used)

Remaining:

- **Generator panel**: drop the difficulty select, show the run's move target,
  render the solution list (replay via the shared `href`/`mode` signals — Board
  already animates `mode="replay"`), show character traits. Keep Preview.
- **`/puzzles/new`**: widen the `mode` signal to `"readonly" | "replay"` and pass
  `href`/`mode` into the panel.
- **Star rating**: half-star hit targets and rendering; widen the `/api/generated`
  rating validation to half steps; fix `list-generated`'s star rendering and its
  rating histogram (both assume integers).
- **Feedback island**: curator difficulty control; persist the note on input
  rather than only on blur, and surface save failures instead of swallowing them
  — a session's worth of comments on `birk` never reached disk and nothing said
  so.
- Bump `GENERATOR_VERSION` to 0.7.0 (candidate distribution changes, so feedback
  buckets aren't comparable across it).
- Tests: gate targeting, the two new metrics, character derivation.
