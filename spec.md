# Progress in a compact cookie

Fourth PR of the perf roadmap. After it, no GET page reads KV for anonymous
visitors. It also retires the planned "defer the stats panel behind a Partial"
idea: the stats become cheap enough to render server-side on the first byte.

## Problem

Home, archives and profile each call `listUserSolutions(userId, { limit:
"max" })`: a prefix scan of up to 10,000 entries, one transatlantic round trip
at best, to derive two things: best moves per puzzle and the streak stats. The
puzzle page lists the user's solutions for that puzzle just to learn
`hasSolved`. All of this is per-user, non-essential state, which per
`/architecture` belongs in a cookie before KV.

## Approach

**A `progress` cookie holds solved puzzles and best move counts.** Only the
counts: the solutions themselves stay in KV, read and written on solve and on
the solutions page. Encoding, in `game/progress.ts` (pure, no browser or KV
knowledge):

- One byte per puzzle number, the best move count, 0 meaning unsolved: daily
  `n` is at index `n`. The unnumbered puzzles (tutorial, lars, lone, loke) get
  fixed numbers from 10,000, so adding one never shifts the dailies. The
  trailing zeros up to 10,000 deflate to about 35 characters.
- The cookie payload is a version byte, the user id, then that array deflated
  with the built-in `CompressionStream`, signed with `signBytes`, the binary
  sibling of the profile's `signValue`. Bumping the version rebuilds every
  device once.
- Deflate rather than bit packing: on simulated play it beats 5-bit packing
  (1.25 KB vs 1.69 KB for 2,700 puzzles at 95% solved) without capping move
  counts, and empty slots of casual players compress to almost nothing. That
  leaves room for about 6,000 puzzles, 16 years of dailies. Today's full
  manifest, all solved, is a 159 character cookie.
- An empty-but-present cookie means "backfilled, nothing solved", so empty
  users are not re-scanned.

`Progress` is `Record<slug, bestMoves>`; solved slugs are its keys. It is
resolved against the manifest at read time because the cookie stores numbers,
not slugs. A slug with neither a number nor a reserved slot is dropped. A
cookie that fails to inflate gives `null`, so the visitor is rebuilt from KV.

**Consumers switch to `Progress`.**

- `game/streak.ts#computeUserStats` takes `Progress` instead of a solutions
  array. Same algorithm; the solutions were only ever reduced to slugs and
  best moves.
- `game/recommendation.ts#pickRecommendedPuzzle` takes `Progress`. It only
  used `solvedSlugs` and `getBestMoves`.
- Home, archives, profile, `/puzzles/recommended` read the cookie. Zero KV.
- Puzzle page: `hasSolved` is `slug in progress.bestMoves`. Zero KV.

**Writes.** The solve POST, after `saveSolution` returns `isNew`, updates the
cookie: `bestMoves[slug] = min(existing, moves.length)`, through
`ctx.state.progress`; the middleware is the only writer, as with the profile.
The tutorial solve is not saved to KV, so it stays out of the cookie too.
Progress is bound to its user id, so a login (which can claim another id)
rebuilds it from KV on the next request, together with the profile.

**Logged-in devices resync every 30 minutes.** Same rule as the profile
cookie (`perf/profile-cookie`): when the profile's `syncedAt` is over 30
minutes old for a logged-in visitor, progress is rebuilt from KV too.
Anonymous visitors never re-read, since an anonymous id is one browser. Read
the profile record and the solutions list in one `Promise.all`, so the refresh
costs one round trip, not two. Streak, calendar and best moves must agree
across devices eventually, not instantly; a device's own solves show
immediately.

**Logout clears it.** Logout is a full reset (`perf/profile-cookie`): add the
`progress` cookie to what it clears, so the device starts over with nothing.

**Backfill, once.** `middleware/user.ts`, beside the profile read so both can
share one round trip: no valid `progress` cookie but a known visitor means run
the old `listUserSolutions` scan one time and set the cookie. A brand-new
visitor gets the empty cookie without a scan. That is the whole migration.

## Migration

Lazy and reversible. Old visitors are backfilled on their next request, one
KV scan, then never again. Rolling back ignores the cookie and scans KV as
today; KV solutions were always written. Tampering is rejected by the
signature and falls back to a backfill.

One e2e consideration: the seed endpoint `/api/e2e/solutions` writes KV
directly, so a test that seeds after its first navigation would hold a stale
cookie. Seeding is a plain `fetch`, outside the browser's cookie jar, so the
`addSolution` fixture clears the `progress` cookie from the browser context
instead, which forces a backfill on the next page.

## Tests

Game logic, test exhaustively with realistic scenarios:

- `game/progress_test.ts`: best of several attempts wins; a better solve
  replaces, a worse one is a no-op; round trips of empty progress and of
  dailies with gaps plus the reserved puzzles; a manifest that gained puzzles
  still resolves, a dropped number is skipped, a slug with no slot is dropped;
  size is one byte per puzzle number up to the highest solved.
- `game/streak_test.ts`: existing scenarios rewritten to feed `Progress`,
  asserting identical outputs to today's.
- `game/recommendation_test.ts` (new): new user, beginner with onboarding left,
  beginner who exhausted onboarding, everything perfected, random pool
  excludes the daily. Runs against the real manifest with scenarios that leave
  exactly one valid pick, so the random choice is deterministic.
- e2e: `returning-user-flow_test.ts` already walks solve → home best-moves,
  and the home stats tests already load `/` with seeded KV solutions and no
  cookie. One storage-exception test deletes the player's KV solutions after
  the first load and asserts the stats still render on reload.

## Acceptance

`db.kv.*` span count on `/`, `/puzzles`, `/profile`, `/puzzles/:slug`: zero
for anonymous visitors with cookies; for logged-in visitors, one refresh per
30 minutes of use. Home TTFB from Europe ≤ 150 ms warm.

## Non-goals

- Replacing KV solutions. They are shared data (scoreboard) and stay in KV.
- Deferring stats client-side. Not needed once the data is cookie-local.
- A cap or eviction policy. At one puzzle a day the cookie reaches 1 KB in
  roughly a year of solving every day; revisit then.
