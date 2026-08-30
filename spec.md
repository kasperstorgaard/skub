# Rating puzzles that weren't generated

## Problem

The scoring engine is already board-agnostic — `computeMetrics`, `compositeScore`
and `scoreBoard` take a `Board` and a `SolverResult` and know nothing about where
the board came from. `score-corpus` already runs the whole of `static/puzzles`
through it.

What's generator-only is everything *around* the score:

- The curation layer (the candidate module, the store directory, the rating UI
  on `/puzzles/generate`) is keyed to files only the generator writes.
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

`generated/` becomes `candidates/`, and the module, route and script that serve
it follow — the docstrings already said "candidate" throughout, and with
`source` arriving, "generated" has to mean provenance and nothing else.

Entries gain `source: "corpus" | "generated"`. This isn't about de-duplication:
the novelty gate runs during generation, so a corpus copy never meets it. It's
that the separation report diffs the two populations, and corpus copies would
appear on both sides and contaminate the comparison it exists to make. Two
values, not three: a board the editor proposes is not a corpus copy, which is
the only distinction the reports need.

### Splitting the gates

`checkGates` currently answers two questions at once:

- **Generation-loop:** G2 (did the run hit its exact `targetMoves`) and G3 (is
  this board novel against the corpus). Both are vacuous or self-contradictory
  for a board that already exists — every corpus puzzle fails G3 by definition.
- **Quality:** G4–G10 — blocker relevance, travel length, wall economy, dead
  space, trapped blockers, clumping. Origin-independent.

Only the second is what candidacy should mean. Split them, and the awkward
asymmetry ("generated boards are gated, human boards are vouched for") disappears
— candidacy is conferred by the quality gates whatever made the board. The
static half (G9–G10) splits off again so the generation loop can still reject a
hopeless layout before paying for a solve.

### Auditing the gates against the corpus

Once the quality half stands alone, run it over all of `static/puzzles`. Those
boards shipped, so every rejection indicts the *gate*, not the puzzle. This is
close to free — the verdict falls out of the solve the reports already cache —
and it's the cheapest evidence available about which gates are miscalibrated. It
also matters ahead of tiling, since tile-assembled boards will be judged by
these same gates.

### `/candidate` — one destination, three ways in

Every board that becomes a candidate arrives at the same page, whatever made it:

- **Generation** hands off to it. `/puzzles/generate` keeps the knobs and the
  run, and stops being a destination — a candidate that clears the gates lands
  here like any other.
- **The editor** reaches it via **Review**, a deliberate act so that idle
  fiddling never lands in the store. It replaces Save, which wrote a board
  straight into `static/puzzles` — one click that skipped candidacy entirely,
  which is the thing this pipeline exists to prevent. Review is now the
  editor's only write.
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

Two things retire into this page. `SolveDialog` — the dev-only "solve it for me"
that writes one solution into the URL — is strictly worse than a scored,
replayable list of all of them. And with that gone, `/api/solve` has no caller
at all, so the board-solving endpoint, its worker and the client stream go with
it, leaving the solver reachable only from `update-puzzles` and the gated hint
route.

`/puzzles/preview` stays. It looked redundant — you can play a board and read
its analysis in one place now — but only if you're the creator: `/candidate`
writes to disk and solves on demand, so it's dev-only, and preview is how
everyone else plays their own draft. It just loses the solve dialog.

### Editing forks a version

A rating describes the board it was given, so editing a candidate makes a new
one rather than changing the rated board underneath. The edit lands as the next
letter of whatever it came from — `erik` → `erik-b` — which is enough to see the
relationship at a glance; nothing tracks lineage, and nothing needs to, because
"the user clicked Edit" is already carried by the draft keeping its name.

That gives `source` its third value. `generated` narrows to mean the generator's
own output and nothing else, so the separation report can still ask what the
generator produces; a variant is `edited`, as is anything drawn by hand. A
reader seeing `erik` generated and `erik-b` edited can infer what happened.

Letters, not numbers: `hans-2` already means "a different board whose name
collided with `hans`", and the two suffixes have to stay distinguishable —
promoting `hans-2` must not ship it as `hans`.

### Promotion

The corpus write doesn't disappear with Save, it moves: `/candidate` grows a
**Promote** button, shown while the board hasn't shipped. So the one path into
the corpus now runs through the page where the board was played, analysed and
rated.

A variant ships under its base name and replaces what's there, keeping that
puzzle's slot and creation date — the point of editing a promoted board is to
change the board, not to reschedule it. Promotion is recorded on the candidate
rather than inferred from a file existing, since a variant ships under a name
that isn't its own: `erik-b` becomes `erik`, and asking "is there a puzzle
called `erik-b`" would answer about the wrong board.

A promoted puzzle arrives complete, so nothing downstream has to repair it: the
measured `minMoves` from the analysis, the curator's `difficulty` rather than
the move count's guess, and the next free schedule number. Only the `Puzzle`
fields travel — the rating, tags, note and analysis stay in the store, which is
the record of how the board earned its place.

### Retiring the anchors hardcode

With corpus puzzles ratable, the four hardcoded ratings in `check-anchors` become
real stored ones — seeded as part of this change so the calibration keeps its
ground truth — and the anchor set stops being four boards.

This also merges `compare-generated` into `check-anchors`: once there's a
`source` field, "which metrics separate kept from rejected" is a rating-separation
question, which is already `check-anchors`' territory. Its tables are too wide
for a terminal, so they go to a report file while the correlations stay on
stdout.

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

New: the `/candidate` route with its Review, Edit and Promote actions, variant
naming for edits, a store module
that owns candidate disk access and the analysis that fills it, `source` on
stored candidates, a split of `checkGates` into static, quality and
generation-loop parts, and a corpus gate audit (`deno task audit-gates`).

Moved: the per-route score readout and replay out of the generator panel and
onto `/candidate`, so it serves any board rather than only a fresh candidate.
`/puzzles/generate` keeps generation and hands off. The curation feedback island
is seeded from page data instead of a cross-island signal, which is what lets it
serve a board the generator didn't make.

Renamed: `generated/` → `candidates/`, along with the module, the API route
(`/api/generated` → `/api/candidates`), the listing script, the `Candidate` type
and the Vite watch-ignore entry.

Retired: `compare-generated`, the `ANCHORS` hardcode, the editor's Save, and
`SolveDialog`. Each took its endpoint with it: `/api/puzzles`, whose corpus
write is now the Promote action, and `/api/solve` along with its client stream,
its worker and the worker's bundle entry.
