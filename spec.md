# Solve POST round trips

The one write path players hit every session. Depends on
`perf/profile-cookie` for its last step but is otherwise independent.

## Problem

The solve POST in `routes/puzzles/[slug]/index.tsx` runs these KV calls, each
a ~110 ms transatlantic round trip, mostly in sequence:

1. `middleware/user.ts` reads the user record
2. `getCanonicalUserSolution` lists the user's solutions for the puzzle
3. `saveSolution` reads the canonical group
4. the atomic commit of four keys
5. `updatePuzzleStats`: two reads in parallel, then a commit
6. `updateCanonicalGroup`: a read, then a commit (parallel with 5)
7. `setUser(name)`: read, then write (parallel with 2–6)
8. `setUser(skillLevel)`: read, then write
9. `getPuzzleStats` for the JSON response

Nine sequential round trips, about a second before the celebration can open.
The client hides part of it behind the board ripple, which is why it has not
been felt as a bug.

## Approach

Target four round trips, without changing what gets written:

- Run 2 and 3 in parallel; neither depends on the other.
- Merge 7 and 8 into one `setUser` call after the skill assessment, with the
  patch `{ name, skillLevel }`. With `perf/kv-read-path`'s `setUser(user,
  patch)` there is no pre-read, and with `perf/profile-cookie` step 1 is gone.
- `updatePuzzleStats` already returns the new stats; use them for the JSON
  response instead of re-reading in 9.
- Keep 5 and 6 as they are: optimistic retries on shared aggregates are the
  right tool, and they already run in parallel. Keep awaiting them; the
  isolate may be evicted after the response, and the scoreboard must not
  drift because of it.

Order the handler so tracking and the cookie update (from
`perf/progress-cookie`) happen after the commit, before the aggregate wait.

## Tests

- `db/solutions_test.ts` against `Deno.openKv(":memory:")`: saving twice with
  the same canonical path returns `isNew: false` the second time; two
  different paths produce two groups; stats histogram counts both; the
  returned stats equal what `getPuzzleStats` reads afterwards. These are the
  invariants the reordering must keep.
- `game/skill_test.ts` already covers the assessment; no change.
- e2e `returning-user-flow_test.ts` covers the celebration; keep green.

## Acceptance

`db.kv.*` spans on the solve POST: at most five, total KV time ≤ 400 ms warm.
Scoreboard counts and histogram unchanged for the same inputs.

## Non-goals

- Fire-and-forget aggregates.
- Changing the solution key layout.
