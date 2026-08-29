# Rating puzzles that weren't generated

## Problem

The scoring engine is already board-agnostic — `computeMetrics`, `compositeScore`
and `scoreBoard` take a `Board` and a `SolverResult` and know nothing about where
the board came from. `score-corpus` already runs the whole of `static/puzzles`
through it.

What's generator-only is everything *around* the score:

- The curation layer (`game/generated.ts`, the `generated/` store, the rating UI
  on `/puzzles/new`) is keyed to files only the generator writes.
- `checkGates` mixes two unrelated questions, so it can't be pointed at an
  existing board at all.

The consequence is that the hand-built corpus — the boards we actually shipped,
the ones that represent "good" — cannot be rated. `check-anchors` compensates
with four hardcoded ratings, and the labelled set that calibration is tuned
against is made entirely of generator output. That's how the rubric ended up
skewed: 19 `too-easy` tags against 0 `too-hard`, because only candidates get
judged, and candidates are disproportionately weak.

Fixing this makes the corpus available as ground truth, which is the strongest
lever we have on a composite that's known to diverge from human judgement.

## Approach

### Vocabulary

Three words, one meaning each. Conflating them is what produced the current
tangle:

- **Analysis** is a *function* — metrics and a score over a board. Gates call it,
  the page calls it, the scripts call it. It owns no directory, no route and no
  lifecycle, which is why the page isn't named after it.
- **Candidacy** is a *state* — a board proposed but not yet approved. That's what
  gets a directory (`candidates/`) and a route (`/candidate`).
- **Anchor** is a *role* — a rated candidate used as a fixed point when checking
  how well the composite tracks human judgement.

### Pipeline

```
draft (KV, per-user)  →  Propose  ─┐
generation (gates passed)  ────────┼→  /candidate  →  candidates/  →  static/puzzles/
an existing puzzle  ───────────────┘
```

Generated boards enter one stage later: passing the gates is what earns them
candidacy, so they skip drafting.

"Draft" already means the per-user working copy in KV (`db/user.ts`), so it stays
that and gains no directory.

### Renaming the store

`generated/` becomes `candidates/`. The folder is currently the only thing not
already using the word — the types (`GeneratedCandidate`, `StoredCandidate`) and
the docstrings say "candidate" throughout.

Entries gain `source: "corpus" | "generated"`. This isn't about de-duplication:
the novelty gate runs during generation, so a corpus copy never meets it. It's
that `compare-generated` diffs `static/puzzles` against the store as two disjoint
populations, and corpus copies would appear on both sides and contaminate the
comparison it exists to make.

### Splitting the gates

`checkGates` currently answers two questions at once:

- **Generation-loop:** G2 (did the run hit its exact `targetMoves`) and G3 (is
  this board novel against the corpus). Both are vacuous or self-contradictory
  for a board that already exists — every corpus puzzle fails G3 by definition.
- **Quality:** G4–G10 — blocker relevance, travel length, wall economy, dead
  space, trapped blockers, clumping. Origin-independent.

Only the second is what candidacy should mean. Split them, and the awkward
asymmetry ("generated boards are gated, human boards are vouched for") disappears
— candidacy is conferred by the quality gates whatever made the board.

### Auditing the gates against the corpus

Once the quality half stands alone, run it over all of `static/puzzles`. Those
boards shipped, so every rejection indicts the *gate*, not the puzzle. This is
close to free — it falls out of the backfill — and it's the cheapest evidence
available about which gates are miscalibrated. It also matters ahead of tiling,
since tile-assembled boards will be judged by these same gates.

### `/candidate` — one destination, three ways in

Every board that becomes a candidate arrives at the same page, whatever made it:

- **Generation** hands off to it. `/puzzles/generate` keeps the knobs and the
  run, and stops being a destination — a candidate that clears the gates lands
  here like any other.
- **The editor** reaches it via **Propose**, a deliberate act so that idle
  fiddling never lands in the store.
- **An existing puzzle** reaches it directly, which is what makes the shipped
  corpus ratable and is the point of the whole exercise.

Today the generator owns a private version of this view — the score readout in
`generator-panel.tsx` already renders the composite, the mean and spread across
routes, and per-route replay, but only for a freshly generated candidate. That
readout, working for any board, *is* this page. It isn't new work so much as
work that needs lifting out of the generator.

So the page owes: the board, its analysis, **every distinct solution scored and
replayable**, and the feedback controls. That per-solution list is load-bearing
rather than a nicety — it's what a curator judges, and per
`[[per-solution-scoring-direction]]` the solution is the future scoring unit.

Note that clone currently mangles identity on purpose — it zeroes `minMoves`,
resets `createdAt`, and renames to "Untitled" outside dev. That's right for
remixing and wrong for analysing, so the source slug needs carrying through; a
stored rating labelled "Untitled, 0 moves" is useless as an anchor.

The page solves server-side and renders a finished result, so it needs no island.

Solving and playing live on the same page. Analysis says whether a board *scores*
well; playing it says how it *feels*, and the whole reason for this work is that
those two have drifted apart. Dropping the human loop while trying to realign
them would throw away the signal.

Three things retire into this page. `/puzzles/preview` becomes redundant once
you can play a board and read its analysis in one place. `SolveDialog` — the
dev-only "solve it for me" that writes one solution into the URL — is strictly
worse than a scored, replayable list of all of them. And with that gone,
`/api/solve` has no caller at all, so the board-solving endpoint, its worker and
the client stream go with it, leaving the solver reachable only from
`update-puzzles` and the gated hint route.

### Retiring the anchors hardcode

With corpus puzzles ratable, the four hardcoded ratings in `check-anchors` become
real stored ones, and the anchor set stops being four boards.

This likely also merges `compare-generated` into `check-anchors`: once there's a
`source` field, "which metrics separate kept from rejected" is a rating-separation
question, which is already `check-anchors`' territory.

### Roles

There are none. A creator is someone running the codebase locally, which is one
person. `isDev` is the creator check — production has a read-only filesystem, so
"writes to disk and opens a PR" is structurally local-only. Normal users never see
generation.

## Non-goals

- **No role or permission system.** See above.
- **No submissions inbox.** A normal user's puzzle is already server-side in KV,
  so a Submit action is a prefix move rather than an email — but local dev and
  production use separate KV stores (`Deno.openKv()` with no argument), so
  draining the queue locally needs `DENO_KV_ACCESS_TOKEN` configured first.
  Separate branch.
- **No recalibration.** This PR makes the corpus ratable and audits the gates
  against it. Acting on what that turns up is the next one.
- **No tiling.** The tile-based generator is the point of the wider effort, but
  it depends on gates that can be trusted, which is what this delivers.
- **Not the anonymous-user KV write.** A cookieless request mints a fresh userId
  and persists a user record on every route, which undermines any per-user quota
  and grows storage from unauthenticated traffic. Real, unrelated, its own branch.

## Scope

New: `/candidate` route, the Propose action, `source` on stored candidates, a
split of `checkGates` into generation-loop and quality halves, a corpus gate
audit script.

Moved: the per-route score readout and replay out of `generator-panel.tsx` and
onto `/candidate`, so it serves any board rather than only a fresh candidate.
`/puzzles/generate` keeps generation and hands off.

Renamed: `generated/` → `candidates/`, with `GENERATED_DIR`, `parseGenerated`,
`formatGenerated` and the Vite watch-ignore entry following.

Retired: `/puzzles/preview`, the `ANCHORS` hardcode in `check-anchors`,
`SolveDialog`, and with its last caller gone — `routes/api/solve.ts`,
`client/use-solve-stream.ts`, `game/solver-worker.ts` and the
`workerBundle("solver-worker")` line in `vite.config.ts`.
