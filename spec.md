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

**A `progress` cookie holds solved puzzles and best move counts.** Encoding,
in `game/progress.ts` (pure, no browser or KV knowledge):

- Numbered puzzles: pairs of `(number, bestMoves)` as a byte string, `number`
  as a varint, `bestMoves` as one byte. Three bytes per solved puzzle, so a
  thousand solves fit well under the 4 KB cookie cap.
- Unnumbered puzzles (tutorial, onboarding): a short slug list appended after a
  separator. They matter only for onboarding recommendation.
- Base64url, prefixed `v1.`, signed with the `lib/signed-cookie.ts` helper from
  `perf/profile-cookie`. An empty-but-present cookie (`v1.` and a tag) means
  "backfilled, nothing solved", so empty users are not re-scanned.

A `Progress` type: `{ bestMoves: Record<slug, number>, solvedSlugs: Set }`,
resolved against the manifest at read time because the cookie stores numbers,
not slugs.

**Consumers switch to `Progress`.**

- `game/streak.ts#computeUserStats` takes `Progress` instead of a solutions
  array. Same algorithm; the solutions were only ever reduced to slugs and
  best moves.
- `game/recommendation.ts#pickRecommendedPuzzle` takes `Progress`. It only
  used `solvedSlugs` and `getBestMoves`.
- Home, archives, profile, `/puzzles/recommended` read the cookie. Zero KV.
- Puzzle page: `hasSolved` is `slug in progress.bestMoves`. Zero KV.

**Writes.** The solve POST, after `saveSolution` returns `isNew`, updates the
cookie: `bestMoves[slug] = min(existing, moves.length)`. The tutorial solve
does the same for its slug. The login callback rebuilds the cookie from KV for
the claimed user id, which is how progress follows a login across devices.

**Devices converge within ten minutes.** Same rule as the profile cookie
(`perf/profile-cookie`): anonymous visitors never re-read, since an anonymous id
is one browser. For a logged-in visitor the progress cookie carries `syncedAt`
and is rebuilt from KV when it is older than ten minutes. Streak, calendar and
best moves must agree across devices eventually, not instantly; a device's own
solves show immediately. Refresh both cookies on the same request so a device
never shows a fresh profile with stale progress.

**Backfill, once.** `middleware/user.ts` (or a sibling `progress` middleware
so each stays small) does: no `progress` cookie but a `user_id` cookie means
run the old `listUserSolutions` scan one time and set the cookie. That is the
whole migration.

## Migration

Lazy and reversible. Old visitors are backfilled on their next request, one
KV scan, then never again. Rolling back ignores the cookie and scans KV as
today; KV solutions were always written. Tampering is rejected by the
signature and falls back to a backfill.

One e2e consideration: the seed endpoint `/api/e2e/solutions` writes KV
directly, so a test that seeds after its first navigation would hold a stale
cookie. Have the seed endpoint also clear the `progress` cookie on its
response, which forces a backfill on the next page. Tests that seed before the
first `goto` need nothing.

## Tests

Game logic, test exhaustively with realistic scenarios:

- `game/progress_test.ts`: encode/decode round trip for 0, 1, 50 and 1,000
  solves; a numbered puzzle that later gains a better score keeps the minimum;
  unnumbered slugs round trip; a cookie from a manifest that has since gained
  puzzles still resolves; decode of a truncated or garbage value yields the
  empty progress, never a throw.
- `game/streak_test.ts`: existing scenarios rewritten to feed `Progress`,
  asserting identical outputs to today's.
- `game/recommendation_test.ts` (new): new user, beginner with onboarding left,
  beginner who exhausted onboarding, everything perfected, random pool
  excludes the daily. Pure given a manifest and a progress; inject the loader
  functions or extract the pure decision from the file reads.
- e2e: `returning-user-flow_test.ts` already walks solve → home best-moves;
  keep it green and add one integration test that loads `/` with seeded KV
  solutions and no cookie, asserting best moves render and the cookie is set.

## Acceptance

`db.kv.*` span count on `/`, `/puzzles`, `/profile`, `/puzzles/:slug`: zero
for anonymous visitors with cookies; for logged-in visitors, one refresh per
device per ten minutes. Home TTFB from Europe ≤ 150 ms warm.

## Non-goals

- Replacing KV solutions. They are shared data (scoreboard) and stay in KV.
- Deferring stats client-side. Not needed once the data is cookie-local.
- A cap or eviction policy. At one puzzle a day the cookie reaches 1 KB in
  roughly a year of solving every day; revisit then.
