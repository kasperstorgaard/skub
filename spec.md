# Achievement stars, high score and a solutions revamp

A stack of PRs, each based on the one before:

1. `stars/rules`: star rules, storage and backfill
2. `stars/display`: stars on the puzzle page, cards, replays and the solutions
   page
3. `stars/celebration`: earning stars is the celebration's payoff
4. `stars/highscore`: the high score page, its links, stars in the home footer
5. `solutions/revamp`: the solutions page on the new design, with Flash

## Stars

Four kinds, each its own colour:

- **Solve**: any solve of the puzzle.
- **Perfect**: a solve in the puzzle's minimum moves. Comes on top of the solve
  star, so a perfect is two stars.
- **First**: being first to find a solution path no one had found before.
- **Flash**: a solve from the Flash start. It takes the solve star's place: a
  later full solve still earns the solve star, and perfect and first need a
  full solve.

Stars are per puzzle, for all time, and each kind is earned once: any puzzle
counts, archive included, so at most solve, perfect, first and Flash on one
puzzle.

A player sees which stars a puzzle still has to give: empty slots by the score
badge before solving, filled once earned. First can't be known in advance, so
its slot reads as a maybe.

## High score

Players rank by star count, ties broken by the rarer kinds: first, then
perfect. Totals per kind live in KV per user, with a ranking index kept in step
on every star earned.

Past solves earn their stars too: a one-off backfill over stored solutions,
with first worked out from solve order, so the board isn't empty on day one.

Links to the high score page: the home footer's star split (next to the streak),
the puzzle page's sidebar and footer, the solutions page and the archive.

## Solutions page

Regular and Flash solves as tabs. Arriving from a Flash solve opens the Flash
tab; Flash solves are compared by the moves played from the Flash start. The
best (optimal) solutions unlock once you've earned stars on the puzzle.

## Non-goals

- Anonymous-first solves and the name prompt after the first star: a later
  stack.
- A first-time explainer of stars in the celebration.
