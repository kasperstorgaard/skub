# Solve telemetry

Difficulty calibration has two label sources and both are weak. Curator ratings
are *inspection* labels — read the solutions, judge the board — which is not the
experience being scored. The behavioural signals pulled from PostHog are
play-derived but thin: solve/abandon rate is broken, hint counts were
bot-corrupted, and mean move-overshoot turned out nearly flat.

This adds the cheapest honest play-derived signal: how long an attempt took and
how much backtracking it needed. Recorded, never rewarded — "fewest moves wins"
is the game, and a visible clock would reward trial-and-error over the
deliberation the puzzles are built around. Nothing here is surfaced to players.

## What lands on `puzzle_solved`

Properties on the existing event, not a new one:

| property | meaning |
| --- | --- |
| `game_duration_ms` | wall clock, first interaction → solve |
| `game_interactions` | total of the four below |
| `game_moves_made` | moves made, including ones later undone |
| `game_undos` / `game_redos` / `game_resets` | backtracking breakdown |
| `game_telemetry_partial` | the attempt's start went unseen, so the numbers are floors |

`game_moves_made` is deliberately distinct from the existing `game_moves`, which
is the final solution length. The gap between them is the point: it separates
solving a board cleanly from flailing to the same answer.

Undo counts may prove the better signal of the two. Wall clock has the idle-tab
problem — people leave a puzzle open for hours — which is why only medians are
meaningful. Backtracking has no such failure mode.

## Reading the interactions off the url

Undo, redo and reset are plain links, so there are no click handlers to hook.
All four interactions are instead derived from url transitions, which catches
keyboard, pointer, link and programmatic paths alike.

One case the url cannot decide: a new move rewrites the moves param and
discards redo history, while a redo advances the cursor over an unchanged one —
but replaying the *same* move after an undo produces a url identical to a redo.
The board asserts those directly, since it knows a move was made.

`observe()` is idempotent per url so the board's watcher and the pre-post read
can both call it. That matters because islands hydrate as separate Preact roots:
the solving move is recorded by the board while the payload is read by
`AutoPostSolution`, and nothing guarantees their effects flush in tree order.

## Partial attempts report, flagged

A url can arrive with moves already in it — a shared link, a refresh, or the
return leg of a hint, which is a full page navigation that wipes module state.
The start of such an attempt went unobserved, so every number it produces is a
floor rather than a total.

Those still report, marked `game_telemetry_partial: true`. Dropping them was the
first instinct and it was wrong twice over: the data cannot be recovered later
if it turns out to be useful, and a dropped partial is indistinguishable from a
no-JS solve, so there is no way to measure how much is being lost or why. The
flag makes three states legible — no telemetry properties at all means no JS,
`false` means an attempt seen whole, `true` means resumed.

**Every insight has to filter on it.** That is the cost of the choice: an
unfiltered median silently skews low, and nothing warns you. Weighed against
losing the data outright, a filter that must be remembered is the better
trade — but it does have to be remembered.

The partial rate is worth reading on its own. It measures how often a solve gets
interrupted by a hint, a refresh or a shared link, which nothing else tracks.

An attempt with no interaction at all still reports nothing — there is no
attempt to describe. No-JS solves likewise, since module state does not survive
full page loads. The game itself is unaffected and still records `game_moves`.

## Non-goals

- **Surfacing any of it.** No timer, no personal best, no leaderboard. Recording
  speed is safe only as long as it is never rewarded; a speed leaderboard is
  also trivially gamed, since `minMoves` is known and solutions are public.
- **Per-user difficulty.** These are aggregate inputs, meaningless per player.
  Comparing a board against what its own players achieve elsewhere needs the
  player fixed-effects approach the behavioural reports already use.
- **Asking the player anything.** A rating prompt is the obvious complement —
  behaviour can measure struggle but never enjoyment — but surfacing it without
  friction is an unsolved design question, and belongs on its own branch.

## Notes

Telemetry is client-reported, so the server drops the whole payload unless every
field is a non-negative integer within a sane bound. Nothing is rewarded on it,
so there is no incentive to forge it; the check only keeps garbage out of the
aggregates.

`beforeprint` fires the reset handler, so printing a puzzle registers a reset.
Left as-is for now.
