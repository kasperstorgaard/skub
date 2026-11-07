# Achievement stars, high score and a solutions revamp

A stack of PRs, each based on the one before:

1. `stars/rules`: score rules, storage and backfill
2. `stars/display`: stars on the puzzle page, cards, replays and the solutions
   page
3. `stars/celebration`: earning stars is the celebration's payoff
4. `stars/highscore`: the high score page, its links, stars in the home footer
5. `solutions/revamp`: the solutions page on the new design, with Flash

## Stars

Four kinds, each shown as an icon (no new colours): check for solve, trophy
for perfect, a path for first, the bolt for Flash.

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

Only earned stars show: no placeholder for unearned ones, and no hint of
what's left to earn anywhere. The stars are a vocabulary players learn. They float left of
the score badge, no background; on cards, left of the best-moves chip in the
top right, in its colours (teal solved, yellow perfect).

Stars stack with an overlap, like an avatar stack, to save space. Each has a
double outline in the background colour of where it sits, which blocks out
part of the star behind it; cards and the page differ, so that colour comes
from the context. A perfect over its solve star then reads as two.

Open: the badge's Flash switch already shows a bolt; whether the earned Flash
star merges with it or sits with the others.

Open: variants of one star icon instead of four icons, so the shape says star
and the variant says the kind: outline for solve, rays between the arms for
perfect (🌟), sparkles for first, a dashed border for Flash. The overlap hides
edges, where rays, sparkles and dashes live, so it stays small enough to keep
each variant readable.

## High score

Players rank by star count, ties broken by the rarer kinds: first, then
perfect. Totals per kind live in KV per user, with a ranking index kept in step
on every star earned.

Past solves earn their stars too: a one-off backfill over stored solutions,
with first worked out from solve order, so the board isn't empty on day one.

Links to the high score page: the home footer's star split (next to the streak),
the puzzle page's sidebar and footer, the solutions page and the archive.

## Solutions page

Three tabs: Solves, Flash and Users.

- **Solves**: as today, a table of rows grouped by solution (canonical path),
  shortest first, but each group lists its players, up to 10, instead of
  "+ x other users".
- **Flash**: the same for Flash solves, compared by the moves played from the
  Flash start. A Flash solve lands here (today it goes back to the solved
  board).
- **Users**: the daily high score, one row per user: points for the solve,
  roughly 50–300, worked out from the stored solutions when shown, not stored.
  How it's worked out is still open.

Each tab is deep linkable: it lives in the URL, so it works without JS and
survives a share or reload.

The best (optimal) solutions unlock once you've earned stars on the puzzle.

## Non-goals

- Anonymous-first solves and the name prompt after the first star: a later
  stack.
- A first-time explainer of stars in the celebration.

## Working notes for the next session

Decided so far (with Kasper, in chat):

- Stack branches: `stars/rules` (this one, base main), then `stars/display`,
  `stars/celebration`, `stars/highscore`, `solutions/revamp`, each based on
  the one before and opened against it. Rebase the next onto main as each
  merges.
- Layer 1 built. Stars are the UI's word; code and KV say score, one point
  per kind, so the display can change without touching storage. Pure rules
  in `game/score.ts` (`getSolveScore` for the kinds a solve scores,
  `getNewScore` against what's earned, user score and highscore rank, and `getPastScore`
  for the backfill, first by solve order); KV in `db/score.ts`: solution
  score per user and puzzle (`solution_score_by_user_puzzle`), user score,
  the aggregate per kind (`user_score`), and the highscore, keyed
  `[total, first, perfect, userId]` and read reversed (`highscore`), all in
  one atomic commit with retries; awarded best effort in the solve POST for new
  solves; `scripts/backfill-score.ts` is safe to re-run. This is solution
  score, what solves earn; `game/scoring.ts` is puzzle score, how good a
  board is.
- Layer 2 built: the progress cookie is v2, two bytes per puzzle (best
  moves, then the solution score as bits), so each device rebuilds it from KV
  once; `ctx.state.score` carries it, updated on award. `components/stars.tsx`
  draws the four variants (outline, rays, sparkles, dashed) on Phosphor's 256
  grid, stacked at a 0.35em overlap, each after the first cutting a gap in
  `--star-knockout`. On the puzzle page, solutions page and replays: the
  viewer's own stars beside the badge. On cards they replace the check/trophy
  chip, beside the move count. The archive calendar keeps its check/trophy.
- Still open: Flash bolt (merge with the badge's switch or not), how many
  stars unlock the best solutions (ask before layer 5).

Environment (cloud sandbox):

- JSR is blocked, so `deno task build`, `deno check` and the dev server don't
  run. npm works.
- Format and lint with CI's Deno 2.7.11 (`npm i --prefix /tmp/deno27
  deno@2.7.11`); newer Deno wraps CSS and Markdown differently and CI fails.
- Unit tests: `deno test -A --no-config --import-map=<map>` with a map that
  points `@std/assert` at a local stand-in and `#/` at the repo.
- See pages with the render harness (Kasper's artifact "Skub render harness":
  three scripts plus steps). Renders components and islands, not routes.
- Commit as Kasper with the Claude co-author trailer; e2e tests aren't wanted
  for every change, and negative assertions aren't wanted at all.
