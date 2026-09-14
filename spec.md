# Multi-solving in the editor

## The problem

While building a board the editor tells you one number: the shortest solution's
length. That is the only thing you learn without leaving the editor.

Everything else you might want to know — how the board is actually solved,
whether there is one route or thirty, which squares the solutions lean on and
which never get touched — lives behind the candidate flow: store the board,
review it, score it, rate it. That is the right weight for curating a corpus and
far too much for the question "is this board any good?", asked twenty times while
laying out walls.

So the board in hand is judged on a single integer, and boards that are too open
or too forced only reveal themselves later, after they have been filed.

## The approach

Ask the board for its first solutions and watch them play, on the board you are
already looking at.

**Where it starts.** The difficulty badge. It already owns the solve — it holds
the move count, runs the debounced solve as you edit, and shows search depth
while it works — so the thing that reports one solution is the natural place to
ask for ten. It becomes a real button rather than a `<span>` with `cursor-help`,
which it should have been regardless.

**Getting the solutions.** `/api/solve` streams one solution today and its worker
stops at the first. Both learn a limit. The solver already builds the complete
shortest-path DAG in exhaustive mode, but `enumerateSolutions` materialises every
optimal route, which is exponential on an open board. It needs a bounded walk
instead: yield solutions off the DAG until the limit is reached, never building
the full set. `deduplicateSolutions` then applies the same order-independent key
the KV path uses, so ten solutions are ten genuinely different ones rather than
reorderings of the same three moves.

Exhaustive search costs materially more than the single-solution path — it drains
the whole optimal depth and tracks every same-depth arrival — so it stays behind
the editor's existing state budget and reports overruns the way the badge already
reports solver errors.

**Watching them.** Each solution that arrives is written into the URL as moves and
replayed. The board already has a replay mode driven entirely by `moves` and
`cursor`, so this is existing machinery: replace the URL state, let it play, move
on to the next. Replacing rather than pushing keeps ten solutions out of the
history stack. The editor page's mode signal is typed to `"editor"` alone and has
to widen so it can flip to replay while the stream runs and back when it ends.

**The heatmap.** As solutions arrive their trails accumulate into a count per
square, drawn as an underlay: above the board's ground, beneath the pieces. A
square used by many solutions reads darker, one no solution ever touches stays
bare — so the shape of the board's answer space is visible at a glance, and dead
space shows up as exactly that.

`computeTrails` already returns what this needs: every square a solution sweeps,
tagged with the piece, the direction and the move index, taken from the slide
itself so a portal leg is included rather than interpolated across the board. The
overlay counts them; it does not compute them.

The colour is a new theme token, set per theme so it can't collide with colours
that theme already uses for pieces, walls or hazards. Opacity scales with the
count. It is an editor instrument, not a showpiece — legible beats handsome.

## Non-goals

- **No scoring, rating or persistence.** Nothing is written. This is a lens on the
  board in hand; the candidate flow stays the way a board gets filed and rated.
- **Never shown to players.** Editor and composer only. Solution trails on a
  puzzle page would give the game away.
- **Not a solution browser.** Solutions stream past and accumulate into the
  heatmap. Stepping through them one at a time is a different feature.

## Open questions

- **Optimal only, or near misses too?** The solver can collect suboptimal
  solutions within a window (`nearDag`), which is what says whether a board is
  forced or merely long. Starting with optimal-length solutions only, since those
  are what "the first ten solutions" most obviously means.
- **Ten, or as many as arrive?** Ten is a readable heatmap and a bounded cost. A
  board with thousands of optimal routes may deserve a count alongside the
  sample, so the ten aren't mistaken for all of them.
