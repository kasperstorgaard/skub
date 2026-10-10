# Stop writing to KV on GET

Second PR of the perf roadmap. Small, no migration, immediate win for every
first-time visitor and every crawler hit.

## Problem

`middleware/user.ts` runs on every request. When the visitor has no user
record it writes one. `setUser` first reads the record again, so a cookieless
request costs three sequential KV round trips (about 330 ms from Amsterdam to
Virginia) before the handler starts. Measured: a new visitor's home page TTFB
is 528–663 ms against 286–333 ms for a returning one.

Crawlers never send cookies, so every crawler request is a "new visitor": a
ghost `["user", uuid]` record per hit, and the write latency on top. The
hint-crawler spec (#237) left this as an open question.

Separately, `game/loader.ts#getPuzzle` reads and parses the puzzle markdown on
every request. It is fast, but it is work repeated per request for data that
only changes on a promote, and the manifest beside it is already cached.

## Approach

**Create the record on first write, not first read.** The middleware builds
the default `{ id, skillLevel: null, theme: "skub" }` in memory when KV has
nothing, and does not write. The record is created by the first mutation:
solving, saving a name or theme, finishing the tutorial. All of those already
go through `setUser`, so the change is local to `db/user.ts`.

**`setUser` stops reading.** The middleware has already read the record into
`ctx.state.user`; pass it in rather than reading again:
`setUser(user, patch)` writes `{ ...user, ...patch }` and returns it, so a
handler that writes twice (the solve POST: name, then skill level) carries the
first write into the second. The one caller without a
record in hand is the auth callback, which keeps a read. Argument order per
CLAUDE.md: target (the user) first, then the patch.

**Cache parsed puzzles.** A module-level `Map<slug, Puzzle>` in `loader.ts`,
cleared by the existing `invalidateCorpus()`. Cached puzzles are deep-frozen,
so an in-place change throws instead of leaking to the next request;
`clone.ts` mutated `ctx.state.puzzle` and now copies. Boards are only
edited as candidates, before promotion, so the cache applies in dev too.

The `/api/migrate` guards in `middleware/auth.ts` and `middleware/user.ts`
stay: the route is added temporarily when a migration runs. A comment now says
so.

## Migration

None. Existing records are untouched. A visitor whose record is created later
than before sees no difference: defaults were already applied in memory.

## Tests

One e2e integration test in `routes/profile/_e2e/profile_test.ts`: a fresh
visitor loads `/profile` and `/api/e2e/users/[userId]` reports no record; after
saving a username the record exists. The endpoint gains a `GET` for this.

No unit tests: `db/` and the loader cache are thin wrappers, which `/testing`
leaves to e2e.

## Acceptance

New-visitor TTFB on `/` within 30 ms of a returning visitor. The `db.kv.*`
spans from `perf/kv-tracing` show one `get` and no `set` on a GET.

## Non-goals

- Removing the remaining KV read on GET. That is `perf/profile-cookie`.
- Purging existing ghost records. Harmless, and a one-shot script can follow
  if KV size ever matters.
