# TODO

Standing backlog — things agreed as worth doing, but not scheduled. Not a spec;
each item needs its own `spec.md` when it gets picked up.

Lifecycle: picking an item up leaves it here while the branch and `spec.md`
exist. The PR that finishes it deletes the item in the same change; `specs/` is
the record of what was built, this file is only what remains. An item that turns
out not worth doing is deleted too, with the reason in the commit message. If a
PR finishes only part of an item, trim the item to what is left.

## Scoring

- **Revamp scoring now that we have better data.** Weight fitting was previously
  blocked on label count. That block is gone.

  Store as of 2026-09-03: **163 rated candidates**, of which **96 carry stored
  scoring, all at `calibrationVersion 5.0.0`** — one uniform, directly
  comparable fitting set. Route-level tagging has grown from 17 boards to **84
  boards / 282 tagged routes** (interesting 114, boring 72, too-easy 53, unique
  43).

  Last measured board-level fit is **ρ = 0.302 at n=119**
  (`scoring/reports/rating-separation-v5.0.0.md`, 2026-08-30). Not yet re-run at
  n=163 — `deno task check-calibration` needs ~15+ min when the solve cache is
  cold for new boards, so budget for it.

  **Preliminary route-level finding (2026-09-03, boards as the unit of analysis
  — sign test over per-board means, so it is not inflated by boards contributing
  many route pairs):**

  - The composite **separates `too-easy` from `interesting`** — on 10 of 11
    boards the too-easy route scores lower (p = 0.012). This confirms the
    earlier small-sample read at scale, and supports using `min` as a too-easy
    gate.
  - The composite **does not separate `boring` from `interesting`** — 44% of
    boards, p = 0.81. Dullness remains invisible to it.
  - Three metrics do show a consistent direction on `boring` routes, all _lower_
    than on interesting ones: `coverage` (20% of boards higher, p = 0.035),
    `deception` (17%, p = 0.039), `totalDistance` (24%, p = 0.049).
    **Suggestive, not conclusive** — n = 12–17 boards each, uncorrected for
    multiple comparisons, and right at the significance boundary. Worth
    designing a dullness term around, not worth trusting as a fitted weight.
    Note all three were dropped from the composite in v3 on _board-level_ ρ; the
    per-solution thesis predicts exactly this, that averaging over routes
    destroyed them.

  **Structural blocker found while measuring:** 13 of 23 metrics have **zero
  within-board variance** — `uniqueSolutions`, `wallUtilization`, `deadSpace`,
  `puckPathVariety`, `clumping`, `emptyRegion`, `wallSymmetry`,
  `firstMovePrecision`, `searchProfile`, `isolationGap`, `nearMissCount` are
  board-level values copied into every route's block. A per-route composite
  therefore has only ~10 real inputs, and per-route dead space genuinely does
  not exist yet. This makes the `unusedQuadrants` idea a prerequisite rather
  than a nice-to-have.

  Re-read the calibration history before re-weighting — several past conclusions
  were fit to a one-directional `too-easy` bias that the board/route tag split
  has since corrected.

- **Pioneer stays within reach as players grow.** Today only the first to find a
  path is its pioneer; with more players the paths get claimed early and the
  star stops being earnable. Make it the first X on a path, X growing with the
  player count.

## Hosting

- **Production data has a backup.** Today production KV has none of its own: no
  snapshot, no continuous S3 backup. Take snapshots with `scripts/export-kv.ts`
  over KV Connect (it only reads), and consider Deploy's continuous S3 backup
  for point-in-time history, which also helps moving off Deno Deploy.

- **Skub keeps running after Deno Deploy shuts down.** Deno joined Cloudflare
  (announced 2026-10-09): Deno Deploy shuts down in about six months, and the
  Deno runtime gets bug-fix and security releases for a year, then development
  ends. Everything hosted on Deploy needs a new home: the app itself, Deno KV
  (users, solutions, stats, candidates — a data migration, not just a redeploy),
  env vars and secrets, the preview deployments whose `deployment_status` events
  drive the e2e workflow, the OTEL traces the perf work reads, and the region
  setting. The `skub.app` DNS is already on Cloudflare. The runtime end means
  the stack choice (Deno, Fresh, `deno test` / `fmt` / `lint`) is on the table
  too, on a longer clock. Cloudflare's path is Workers and Durable Objects
  (self-hostable via workerd merged with Deno's celld).

  Runtime target: [workerd](https://github.com/cloudflare/workerd). Lean: host
  on Cloudflare Workers and move the toolchain to Bun (tests, formatting,
  linting, tasks), since Deno's development ends. Open question is the store. What skub relies on in Deno KV: atomic multi-key writes
  with versionstamp checks (a solution under four index keys),
  optimistic-concurrency retries on shared counters (puzzle stats), ordered
  prefix scans (`listUserSolutions`, solutions by puzzle, canonical groups), and
  read-after-write on the solve POST.

  The data migration leaves the bot `user` records behind: over a million
  default records from before GETs stopped writing to KV (#244), with no name,
  theme or skill level, no solution and no login. The hourly backup's file is
  the natural source for the move; after it, the backup reads `user` whole.

  - **Workers KV:** eventually consistent (~60 s), no atomics — breaks the solve
    flow and stats. Fine only for cache-like data such as the manifest.
  - **D1 (SQLite):** the most direct port. Index keys become one table with
    indexes, prefix scans become `WHERE`, stats retries become one `UPDATE`.
    Single primary region with read replicas, like KV in Virginia today, which
    cookie-first GETs already sidestep.
  - **Durable Objects + SQLite:** strongly consistent per object, no retry logic
    (e.g. one object per puzzle, one per user). A bigger data-model rethink, but
    it's what celld runs, so managed and self-hosted stay interchangeable.

  Lean: Durable Objects — it's the model Ryan Dahl's celld is built around and
  what Cloudflare's self-hosting path centres on. D1 stays the fallback if the
  redesign proves too big.

- **E2E runs start from clean data.** Today every preview deployment shares
  one KV database (`{app-id}-preview`), so runs that overlap across a stack,
  and runs cancelled before teardown, leave data the next run sees: a fixed
  test name on a shared puzzle (`e2ellie` on karla) can show up twice, or
  drop out of the solutions page's first six. On the next provider, each run
  gets a clean database, either fresh from the start or cleaned by a script
  before it runs.

## Performance

- **The site should feel instant.** Pages are 6 KB of HTML, yet first paint is
  1–2.5 s and every navigation re-downloads the scripts and fonts. Target: first
  paint under a second, in-site navigation indistinguishable from a static site.
  Specs with budgets and order exist on the `perf/*` branches; the first one
  holds the measured baseline.

- **The next page should be ready before you tap it.** Prefetch likely
  destinations on hover or touch-down so the puzzle appears the moment the card
  is pressed. Comes after the server work above, so a prefetched page is cheap
  and the server is measured before prefetch hides it.

## UI

- **Retro themes follow the new layout.** The main look moved on: play controls
  are a toolbar beside the board, the score badge replaced the difficulty badge
  and move counter, the sidebar has a footer, and cards lost their difficulty
  tag. Retro themes still style the old pieces (`.move-counter`,
  `.puzzle-card-difficulty`, the header builder icon) and need a pass to match.

- **A solution says when it was found.** The solutions page shows who claimed
  each path and how many moves it takes; it doesn't say when.

- **On mobile, all puzzles are one feed to flick through.** A snap-scrolling
  feed of puzzle cards, newest first, that reads as one seamless list. The card
  in view keeps `?date=` current, so going back from a puzzle returns to the
  same spot. Without JS it's paginated, with a link to earlier puzzles.
  Tentative: use lazy loading infinite scroll with a transform sentinel (sized
  from the known total to the cards still to come) as a progressive improvement
  on the no-JS pagination. Desktop keeps the month calendar, which still needs a
  visual pass too.

- **Flash on feels alive.** While Flash is on, the bolt in the toolbar gives off
  a slow trickle of particles. Subtle, never distracting, and off under reduced
  motion.

- **Undo and redo are easy to hit with a mouse.** Check whether the desktop
  toolbar's buttons, sized like the editor's, are too small for quick undo/redo,
  and size them up if so.

- **A celebration that feels like a win.** Revamp the solve dialog: the wording
  (factual, never grading the play) and the celebration moment itself. The
  payoff is the stars you just earned animating in (see the stars item under
  Play). A solve longer than the shortest gets a soft line that also teaches the
  score badge, e.g. "If you're curious, the shortest possible path is 4 moves",
  so "6/4" reads right from then on.

- **The score badge reads at a glance.** It shows moves played over your best
  (`3/9`). Figure out whether it reads better flipped, your best first and the
  live count on the right, beside the stars you've earned. Flipped, the slash
  reads as a ratio, so it likely needs another shape, e.g. a small "best 9" by
  the stars. The celebration item's "6/4" example assumes the old badge.

- **Smoother page changes.** View transitions between pages, opt-in per
  navigation. Going into a board page zones in, the page settling back around
  the board, so its narrower mobile width reads as focusing in rather than a
  jump. Opening a puzzle from its card swaps that card's thumbnail for the real
  board, one element morphing into the other. The thumbnail may need to be
  higher quality than today's, so the hand-off doesn't show a jump in detail.

## Play

- **Every player can rate a puzzle.** A Rate action opens a dialog for
  difficulty, fun and a line of feedback, so ratings come from players, not only
  from Kasper's local rating flow. It's offered where a player has just played
  or looked back: the puzzle page's sidebar (the footer on mobile), the
  celebration after a solve, and the solutions page. The celebration already has
  two calls to action, its limit, so Rate takes one of those slots or its one
  link. The local flow stays as it is, for calibration.

- **Flash starts can be chosen by hand.** Today each puzzle's Flash start is
  generated on promotion: the opening moves of the solver's first optimal
  solution. Let Kasper or helpers pick a more interesting starting point
  instead, for example in the editor or on the candidate page.

- **The spot under the board always offers the next step.** One lead-in line and
  one action, picked by state in a fixed order, with one wording per state: new
  players get the tutorial, stuck players get Flash, a replay of a solved puzzle
  offers Rate, a fresh solve offers See solutions. The sidebar becomes footer
  and navigation only. The editor already works this way ("Happy with it? Send
  it in").

- **Builders send a puzzle in once they've solved it themselves.** The preview
  page offers "Send it in" after the builder solves their own puzzle there, so
  what gets sent is proven playable. The editor's nudge stays as the shortcut.

- **Builders see where Flash starts.** A Flash mode in the editor marks the cell
  the computed Flash start lands the puck on with a Flash icon, so the builder
  knows where Flash players begin while shaping the board.

- **Flash solves get stats of their own.** The solutions page's Flash tab lists
  them by path, worked out from the solves; they still have no stats, so the
  celebration can't compare a Flash solve against other Flash solves.

- **A player's first stars come with an explainer.** The first celebration a
  player sees says what stars are and how to earn them: one for a solution, two
  for perfect or first, three for both.

- **Players play without being asked for a name.** Today a new player's first
  solve asks for a name before anything else. Instead, every solve is saved and
  counts from the start, anonymous or not, and the name prompt comes as the
  natural next step after the first star: you just earned a star, pick a name to
  put it on the board. Opening a puzzle's solutions or the high score page
  offers the same prompt to players who skipped it.

  Solves are keyed by user id; the name is a copy saved on each one, which
  renaming in the profile doesn't touch today. So: solves start anonymous, and
  picking a name writes it back to that user's solves (listed by
  `solutions_by_user`: all four keys per solve, plus a leaderboard group's
  `firstSolution` where it's theirs), soon enough that their next look at a
  board shows it. Keeps leaderboard reads free of user lookups.

- **A player's name stays the name others saw.** Once picked, a name is
  permanent: the profile shows it but can't change it. Players have seen names
  next to solutions, so a name changing under them would break that. Today the
  profile's name field renames freely (past solves keep the old name).

  The open part is collisions: nothing stops two players picking the same name
  today, and a permanent name makes a clash permanent too. Claim names
  atomically when picked, so one name is one player.

- **Every player sees how others solved a puzzle.** Showcase other people's
  solutions where players already are, for new and old players alike, instead of
  behind the highscore page where few find them. Stands on its own; the tiered
  unlock in the stars item can layer on later.

- **Playing keeps working offline.** Solves and progress save to the device
  (IndexedDB) and sync to the server once back online, so a dropped connection
  never loses a solve. Not Linear's model as is: IndexedDB is client-only, and
  the game has to work without JS, so it needs a model of its own where the
  server path (cookies and KV, as today) and the IndexedDB path are easy to swap
  behind one shape, JS adding the local copy on top. The server stays the
  source of truth, since the browser can evict IndexedDB at any time, and
  reading it may be too slow per move, so the copy might load into memory on
  page load.

## Login

- **Logging in on a second device should bring that device's solves along.**
  Today the account keeps the first device's history and later devices'
  anonymous solves are left behind. Merge them when the device was anonymous at
  login. Specced on `feat/login-merge-history`.
