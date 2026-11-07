# Achievement stars, high score and a solutions revamp

A stack of PRs, each based on the one before:

1. `stars/rules`: score rules, storage and backfill
2. `stars/display`: stars on the puzzle page, cards, replays and the solutions
   page
3. `stars/celebration`: earning stars is the celebration's payoff
4. `stars/highscore`: the high score page, its links, stars in the home footer
5. `solutions/revamp`: the solutions page on the new design, with Flash

## Stars

Three stars per puzzle at most, one rounded star with a slim outline, drawn
three ways:

- **Solve**: any solve of the puzzle. An outline.
- **Perfect**: a solve in the puzzle's minimum moves, on top of the solve
  star. Filled, with tiny rays between the arms.
- **First**: being first to find a solution path no one had found before. The
  outline in thirteen even dashes that don't line up with the tips.

A Flash solve earns the solve star in the pearl (`--pearl`, Flash mode's own
look), the only star that changes colour. A later full solve turns it into the regular
solve star, moving the point from Flash to solve; perfect and first need a
full solve.

Stars are per puzzle, for all time, and each kind is earned once: any puzzle
counts, archive included.

Only earned stars show: no placeholder for unearned ones, and no hint of
what's left to earn anywhere. The stars are a vocabulary players learn. They
float left of the score badge, no background; on cards, alone in the top right
(no move count). The theme's puck colour (`--color-ui-2`): shape and count
tell the kinds apart.

Stars stack with a 0.3em overlap, like an avatar stack, to save space. Each
after the first cuts a gap out of the one behind in the background colour of
where it sits; cards and the page differ, so that colour comes from the
context (`--star-knockout`).

Open: the badge's Flash switch already shows a bolt; whether that matters next
to a Flash-coloured solve star.

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

- Stack branches: `stars/rules` (base main), then `stars/display`,
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
  draws the stars as above. On the puzzle page, solutions page and replays:
  the viewer's own stars beside the badge. On cards they replace the
  check/trophy chip and the move count; the archive calendar's cells show
  them too. Kinds always come from the stored score per puzzle, never worked
  out from best moves against minimum moves.
- All-time per user is an updated aggregate, not computed: each puzzle
  counts up to a max, so the total is a sum of per-puzzle bests, and a
  better solve only adds its gain over the old best. Stored per user beside
  the per-puzzle best, in the award's commit. Built with the points
  calculation (layers 4/5).
- Flash is not a star of its own: a Flash solve scores `flash`, which shows as
  the solve star in the pearl; a full solve swaps it for `solve`
  (`withEarned`), moving the point, so three stars at most per puzzle.
- The first solve of a path is marked `first: true` on the solution, claimed
  atomically in `saveSolution` (`solution_paths_by_puzzle`); the backfill
  marks old ones by solve order.
- Layer 3 built (`stars/celebration`): the solve POST returns the player's
  stars on the puzzle after the solve as `stars` in `CelebrationData`, and
  the dialog diffs them against the stars the page loaded with. All of them
  show on the headline's row, at the headline's size; only the ones gained
  (new, or solve replacing Flash) fly in one by one on a curve, fading in,
  each from one of five starts evenly spaced on a 1em circle around 4em left
  and 2em up of where it lands, drawn at random with no two the same
  (motion-safe only). The existing stars show from the start, so nothing
  shifts when the data lands. The headline is just "Solved!" or "Perfect!",
  over one fixed line, "Thanks for playing. What's next?", leading into the
  actions, for every solve: the stars carry the news, so the stats
  lines (first to solve, new path, percentiles, counts) and the loading state
  are gone. The main action is "Keep playing".
  No-JS solves get no dialog for full solves (they go to
  the solutions page), so they don't show the payoff; the page's own badge
  stars update on the next load.
- Layer 4 next (`stars/highscore`, based on `stars/celebration`).
- Still open: the badge's Flash bolt next to a Flash-coloured solve star; how
  many stars unlock the best solutions (ask before layer 5); highscore ties
  past total, first and perfect are by user id (earliest-to-reach would need
  a timestamp in the key); the daily high score's points calculation.

Environment (cloud sandbox):

- JSR is blocked, so `deno task build`, `deno check` and the dev server don't
  run. npm works.
- Format and lint with CI's Deno 2.7.11 (`npm i --prefix /tmp/deno27
  deno@2.7.11`); newer Deno wraps CSS and Markdown differently and CI fails.
- Unit tests: `deno test -A --no-config --import-map=<map>` with a map that
  points `@std/assert` at a local stand-in and `#/` at the repo.
- See pages with the render harness (Kasper's artifact "Skub render harness":
  three scripts plus steps). Renders components and islands, not routes.
  `deno install` with Deno 2.7.11 fetches the npm side (Tailwind) despite the
  JSR errors. Run `shot.mjs` with `NODE_PATH=$(npm root -g)`. `css.mjs` only
  adds the skub theme; append another theme's CSS (fonts rewritten to
  `file://`) to compare themes.
- `deno check` on single components works with the repo config (no JSR in
  their graph); routes and middleware can't be checked here.
- Force pushes need asking first; a rebased stack branch needs one.
- Commit as Kasper with the Claude co-author trailer; e2e tests aren't wanted
  for every change, and negative assertions aren't wanted at all.
