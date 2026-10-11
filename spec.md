# Solve POST round trips

The one write path players hit every session.

## Problem

The solve POST in `routes/puzzles/[slug]/index.tsx` ran these KV calls, each a
~110 ms transatlantic round trip, mostly in sequence. With the profile and
progress cookies the middleware no longer reads KV, which leaves:

1. `getCanonicalUserSolution` lists the user's solutions for the puzzle
2. `saveSolution` reads the canonical group
3. the atomic commit of four keys
4. `updatePuzzleStats`: two reads in parallel, then a commit
5. `updateCanonicalGroup`: a read, then a commit (parallel with 4)
6. `setUser(name)`: read, then write (parallel with 1–5)
7. `setUser(skillLevel)`: read, then write
8. `getPuzzleStats` for the JSON response

Six sequential round trips on a typical solve, eight on a level-up, before the
celebration can open. The client hides part of it behind the board ripple,
which is why it has not been felt as a bug.

## Approach

Four sequential round trips on every new solve, without changing what gets
written:

- Run 1 and 2 in parallel; neither depends on the other.
- `saveSolution` resolves right after the commit, with the aggregate update as
  a `stats` promise (never rejects; on failure it logs and reads stats as they
  are). The handler tracks, assesses skill and updates the progress cookie
  state in that gap.
- Merge 6 and 7 into one `setUser` call after the skill assessment, with the
  patch `{ name?, skillLevel? }`, skipped when empty. `setUser` keeps its
  pre-read (another device may have written since the cookie was issued), but
  its read and write run alongside the aggregates' read and commit.
- `updatePuzzleStats` already returns the new stats; use them for the JSON
  response instead of re-reading in 8. A repeated path has no aggregate
  update, so its `stats` is a plain read, also run alongside the user write.
- Keep 4 and 5 as they are: optimistic retries on shared aggregates are the
  right tool, and they already run in parallel. Keep awaiting them, on both
  the JSON and the no-JS path; the isolate may be evicted after the response,
  and the scoreboard must not drift because of it.

Resulting waterfall: [list ‖ group read] → commit → [stats reads ‖ group read
‖ user read] → [stats commit ‖ group commit ‖ user write].

`KV_PATH` (unset in production) lets unit tests open `:memory:`.

## Tests

No unit tests: the change is ordering of KV calls, not pure logic, and KV is
left to e2e. The e2e solve flows (`returning-user-flow_test.ts`, the puzzle
page tests) cover saving, the celebration stats and the scoreboard.

`game/skill_test.ts` already covers the assessment; e2e
`returning-user-flow_test.ts` covers the celebration.

## Acceptance

`db.kv.*` spans on the solve POST at most four deep (sequential), total KV time
≤ 400 ms warm. Scoreboard counts and histogram unchanged for the same inputs.

## Non-goals

- Fire-and-forget aggregates.
- Changing the solution key layout.
- Dropping `setUser`'s pre-read.
