# Achievement stars, high score and a solutions revamp

A stack of PRs, each based on the one before:

1. `fix/one-dialog`: one dialog at a time, solve dialogs give way to URL
   dialogs
2. `copy/solutions-wording`: solutions for what players saved, paths for the
   routes, and the name dialog's copy
3. `flash/toolbar`: the Flash switch moves from the score badge to the toolbar
4. `stars/rules`: score rules, storage and backfill
5. `stars/display`: stars on the puzzle page, cards, replays and the solutions
   page
6. `stars/celebration`: earning stars is the celebration's payoff
7. `stars/highscore`: the high score page, its links, stars in the home footer
8. `badge/your-best`: the score badge shows your best in place of the shortest
9. `solutions/revamp`: the solutions page on the new design, with Flash

## Stars

Stars belong to a solution, three at most, one rounded star with a slim
outline, the same for every kind; the count tells them apart:

- **One**: any solution.
- **Two**: a solution in the puzzle's minimum moves (perfect), or the first to
  find a path no one had found before, in at most two moves more than the
  minimum, or any detour would find one (first).
- **Three**: both, a new perfect path. Rare by design: a puzzle has few
  optimal paths, and they're claimed early.

A Flash solve earns a single star in the pearl (`--pearl`, Flash mode's own
look), the only star that changes colour; perfect and first need a full
solve.

A player's stars on a puzzle are their best single solution's, for all time,
any puzzle, archive included: solves don't add up. A better solution
replaces them (more stars, or a full solve over a Flash one); on a tie the
earlier stays.

Only earned stars show: no placeholder for unearned ones, and no hint of
what's left to earn anywhere. They float left of the score badge, no
background; on cards, alone in the top right (no move count); on the
solutions page, beside each path's claimer. The theme's puck colour
(`--color-ui-2`).

Stars stack with a 0.3em overlap, like an avatar stack, to save space. Each
after the first cuts a gap out of the one behind in the background colour of
where it sits; cards and the page differ, so that colour comes from the
context (`--star-knockout`).

The Flash switch lives in the toolbar, not the badge, so the stars don't sit
against its bolt.

## High score

Players rank by points: 50 a star, so 150 at most per puzzle. Stars alone
would make a week's best 21; 1,050 reads like the high score it is. Ties are broken by the rarer kinds:
first, then perfect. Totals per kind live in KV per user, with a ranking index kept in step
on every star earned.

Past solves earn their stars too: a one-off backfill over stored solutions,
with first worked out from solve order, so the board isn't empty on day one.

Two boards, switched in the URL: this week and all time. This week counts
only the stars on the week's dailies (Monday to Sunday), so everyone races on
the same boards; archive play moves only all time. It is worked out from those
puzzles' stored solutions when shown, not stored.

Links to the high score page: the home footer's star split (next to the streak),
the puzzle page's sidebar and footer, the solutions page and the archive.

## Solutions page

Two tabs, Regular and Flash, the high score's pill switch, in the URL
(`?tab=flash`) so they work without JS and survive a share or reload. The
switch sits beside the title, on its bottom line, where the score badge and
stars were: the page is about the paths, not your score. A replay's badge
shows the solution's moves against the shortest, with the stars that
solution earned beside it. Flash
solves start part way in, so they're shorter and get a list of their own.

Each tab lists paths, shortest first. A path shows, podium style, the player
who claimed it (found it first) with its move count, and under them the next
five players who found it, then how many more. Flash paths are counted from
the Flash start. A Flash solve lands on the Flash tab.

Every path has a Watch button. The way in is the gate: the puzzle page links
to its solutions once you've solved it, any solve, Flash included (to the
Flash tab while Flash is on), and nothing inside the page or the replays
checks again. Copying a better path is open, for now.

## Non-goals

- Anonymous-first solves and the name prompt after the first star: a later
  stack.
- A first-time explainer of stars in the celebration.

## Working notes for the next session

Decided so far (with Kasper, in chat):

- Stack branches: `fix/one-dialog` (base main), then
  `copy/solutions-wording`, `flash/toolbar`, `stars/rules`, `stars/display`,
  `stars/celebration`, `stars/highscore`, `solutions/revamp`, each based on
  the one before and opened against it. Rebase the next onto main as each
  merges. Generic side changes go at the bottom, so the layers above build on
  them instead of conflicting with them.
- Wording: a solution is what a player saved, a path is its route, and solve
  is the verb. Matches the `/solutions` URL and the code.
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
  are gone. The main action is "Next puzzle", the other "Start over".
  No-JS solves get no dialog for full solves (they go to
  the solutions page), so they don't show the payoff; the page's own badge
  stars update on the next load.
- Layer 4 built (`stars/highscore`): `/highscore` lists the top 50 from the
  `highscore` index, names from the user records (`getUserNames`, "Anonymous"
  without one), each row its rank, its stars per kind and the total; the
  viewer's row is marked, and when they're outside the top 50 it follows a
  "…" without a rank, from their cookie score (`getProgressScore`). The home
  footer's Stars stat (total and split, after the streak) links there, as do
  "High score" buttons in the puzzle page's panel (its sidebar on desktop,
  its footer on mobile), the solutions page's panel and the archive's.
- High score since: the top three as a podium (bigger, with their stars), the
  rest a plain numbered list; a pill switch on the right picks this week
  (`/highscore`) or all time (`?period=all`). This week is worked out per
  request from the week's dailies (`getWeekHighscore`, `getHighscore`), so the
  viewer's rank is known there even past the top 50; all time reads the
  stored index.
- Layer 5 next (`solutions/revamp`, based on `stars/highscore`).
- Decided in layer 4: ties past points, first and perfect go by user id, and
  that's fine. A Flash solve is worth a solve's 50: missing perfect and first
  is penalty enough. The star is called Pioneer in the UI: several can open a
  puzzle, one per path. Home and profile show
  streak, points and the stars (Solved, Perfect, Pioneer; Flash counts as
  solved), and a trophy in the header links to the high score.
  Rate is gone from the puzzle page (it's the candidates flow).
- Nothing runs against production (backfill, reindex) until Kasper has
  cleaned up and tested the stack.
- Layer 5 plan (`solutions/revamp`, on `badge/your-best`), with Kasper:
  one solutions page, no Users tab (the high score page covers ranking), Flash
  as its own tab. Replays open after any solve, and only the links in check
  it: stricter rules (only as good as your best) were weighed and dropped as
  too harsh. Defaults picked:
  - The pill switch moves out of the high score into a shared component.
  - Players per path from `solutions_by_puzzle_canonical` (the claimer plus
    five); Flash paths from the puzzle's Flash solves, by the canonical key of
    the moves after the Flash start, worked out per request.
  - Rows take the high score's plain list look: no cards.

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
