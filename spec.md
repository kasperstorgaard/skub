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

A player sees which stars a puzzle still has to give: the icons float left of
the score badge, no background, dimmed until earned. On cards they float left
of the best-moves chip in the top right, in its colours (teal solved, yellow
perfect). A perfect shows check and trophy both, for now.

Open: the badge's Flash switch already shows a bolt; whether the earned Flash
icon merges with it or sits with the others.

Open: variants of one star icon instead of four icons, so the shape says star
and the variant says the kind: outline for solve, rays between the arms for
perfect (🌟), sparkles for first, a dashed border for Flash. Unearned would then be
the dimmed variant, since an outline is already solve; and a perfect might show
the filled star alone while still counting two.

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

## Working notes for the next session

Decided so far (with Kasper, in chat):

- Stack branches: `stars/rules` (this one, base main), then `stars/display`,
  `stars/celebration`, `stars/highscore`, `solutions/revamp`, each based on
  the one before and opened against it. Rebase the next onto main as each
  merges.
- Layer 1 built. Stars are the UI's word; code and KV say score, one point
  per kind, so the display can change without touching storage. Pure rules
  in `game/score.ts` (`getSolveScore` for the kinds a solve scores,
  `getNewScore` against what's earned, totals and rank, and `getPastScore`
  for the backfill, first by solve order); KV in `db/score.ts`:
  `score_by_user_puzzle`, `score_totals_by_user`, and a `score_ranking` index
  of `[total, first, perfect, userId]` read reversed, all in one atomic
  commit with retries; awarded best effort in the solve POST for new
  solves; `scripts/backfill-score.ts` is safe to re-run. Not to be confused
  with `game/scoring.ts`, which rates puzzles.
- Cards are server-rendered from the progress cookie (one byte of best moves
  per puzzle, `game/progress.ts`). Solve and perfect follow from it; first and
  Flash need extra bits, a layer 2 concern.
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
