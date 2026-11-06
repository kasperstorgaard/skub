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

## Hosting

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

  Runtime target: [workerd](https://github.com/cloudflare/workerd). Open
  question is the store. What skub relies on in Deno KV: atomic multi-key writes
  with versionstamp checks (a solution under four index keys),
  optimistic-concurrency retries on shared counters (puzzle stats), ordered
  prefix scans (`listUserSolutions`, solutions by puzzle, canonical groups), and
  read-after-write on the solve POST.

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

- **The solutions page feels like part of the new look.** Revamp it to match
  the puzzle page: the title with its lead line, the score badge, the type
  roles and spacing levels, secondary buttons, and the sidebar and mobile
  footer. The solve list itself gets a visual pass too, so a solve reads at a
  glance (who, how many moves, when).

- **The editor matches the new design.** The builder and its preview still
  carry the old look in places: bring them onto the same title, type roles,
  spacing levels, buttons and sidebar/footer as the puzzle page, so building a
  puzzle feels like the same app as playing one.

- **The archive reads like a week on mobile.** On phones, the archive works like
  a calendar app's week view: a strip of days to swipe through, the chosen day's
  puzzle below. Desktop keeps the month calendar, which still needs a visual
  pass too.

- **Board walls look built, not drawn.** Walls that meet join up into one shape
  instead of separate strokes, and every wall sits exactly on the line between
  cells (today they're slightly off).

- **Flash on feels alive.** While Flash is on, the bolt in the score badge gives
  off a slow trickle of particles. Subtle, never distracting, and off under
  reduced motion.

- **Undo and redo are easy to hit with a mouse.** Check whether the desktop
  toolbar's buttons, sized like the editor's, are too small for quick undo/redo,
  and size them up if so.

- **A theme with more edge.** The design is clean but flat. Subtle noise or
  grain, soft gradients, a few geometric shapes as accents. The main theme stays
  modern; the others get to diverge on shape and texture once there are tokens
  for it.

- **A celebration that feels like a win.** Revamp the solve dialog: the wording
  (factual, never grading the play) and the celebration moment itself. The
  payoff is the stars you just earned animating in (see the stars item under
  Play).

- **Smoother page changes.** View transitions between pages, opt-in per
  navigation. Needs the Fresh 2.3 upgrade first.

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

- **Flash solves get a leaderboard of their own.** Flash solves are already
  stored with names, as regular solutions marked `flash`; the leaderboard skips
  them because they never enter the aggregates. Give them a board beside the
  normal one (a tab or filter on the solutions page) and stats of their own, so
  the celebration can compare a Flash solve against other Flash solves.

- **Players earn stars each day for what they achieve.** 1 star for a solve, 2
  for a perfect, 1 for being first to find a solution, capped at 3 per puzzle
  per day: a perfect, never-seen solution is 3 stars on its own, and three
  separate solves are 1 each. Stars add up into all-time leaderboards, and
  puzzle thumbnails show each puzzle's stars so players can see what's left to
  earn. Open: should a solve only count within 2 moves of perfect? Leaning
  towards a tiered solutions page: suboptimal solutions stay open to everyone,
  and the optimal ones unlock once you've earned stars on the puzzle yourself.
  New players learn from the solutions within reach; the best play is the
  reward. This fits the badge, which already hides the shortest count until
  you've solved the puzzle. Separate solves earn stars too, so players without a
  perfect have a route to the unlock. Open: how many stars unlock it, 1 or 3?
  Simpler cousin, also open: should See solves stay closed until you've solved
  the puzzle at all? Puzzle cards show your result where the difficulty tag used
  to sit (bottom right): your best score, and your stars once they exist.
  Earning stars is the celebration's payoff: they animate in as the moment of
  the solve. The first celebration a player sees explains what stars are and how
  to earn them. The solutions page shows the stars earned on the puzzle.

- **Players play without being asked for a name.** Today a new player's first
  solve asks for a name before anything else. Instead, every solve is saved and
  counts from the start, anonymous or not, and the name prompt comes as the
  natural next step after the first star: you just earned a star, pick a name to
  put it on the board. Opening a puzzle's solutions or the high score page
  offers the same prompt to players who skipped it.

  Solves are keyed by user id; the name is a copy saved on each one, which
  renaming in the profile doesn't touch today. So: solves start anonymous, and
  picking or changing a name writes it back to that user's solves (listed by
  `solutions_by_user`: all four keys per solve, plus a leaderboard group's
  `firstSolution` where it's theirs), soon enough that their next look at a
  board shows it. Keeps leaderboard reads free of user lookups.

- **Players can see who has the most stars.** A high score page ranks players by
  all-time stars, linked from home's sidebar, the archive and the solutions
  page. Builds on the stars item above.

- **Every player sees how others solved a puzzle.** Showcase other people's
  solutions where players already are, for new and old players alike, instead of
  behind the highscore page where few find them. Stands on its own; the tiered
  unlock in the stars item can layer on later.

## Login

- **Logging in on a second device should bring that device's solves along.**
  Today the account keeps the first device's history and later devices'
  anonymous solves are left behind. Merge them when the device was anonymous at
  login. Specced on `feat/login-merge-history`.
