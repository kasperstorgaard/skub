# User record in a signed cookie

Third PR of the perf roadmap. Removes the KV read that every single GET pays,
including the error page and the og-image.

## Problem

`middleware/user.ts` reads `["user", id]` on every request to get three small
values: theme, skill level, name (plus email for the few logged-in users).
That read is a transatlantic round trip, about 110 ms, and it runs before the
handler so nothing overlaps it. It is the floor under every page's TTFB.

Logged-in visitors pay a second one: `middleware/auth.ts` reads
`["auth_session", id]` to map the session cookie to a user id.

Per `/architecture` state order, per-user non-essential state belongs in a
cookie before it belongs in KV. The user record qualifies: the game plays the
same without it.

## Approach

**A `profile` cookie carries the record.** Value: base64url JSON
`{ v: 1, id, sessionId?, syncedAt, theme, skillLevel, name, email }` followed by `.` and an HMAC-SHA256
tag (Web Crypto, first 16 bytes, base64url) keyed by a new `COOKIE_SECRET`
env var. Signing matters because `skillLevel` gates the recommendation and
`email` must not be spoofable. `httpOnly`, `secure` outside dev, `SameSite=Lax`,
5 years, same as `user_id`.

The payload is bound to its user: it is trusted only when `id` matches the
request's user id. A cookie left behind by a logout or an account switch is
then ignored rather than believed.

Put the codec in `lib/signed-cookie.ts` (portable, no game knowledge) and the
profile shape in `lib/user-cookie.ts` next to the existing user id cookie.
Outside dev a missing `COOKIE_SECRET` is a startup error, not a silent
unsigned cookie.

**Middleware reads the cookie, falls back to KV once.** Order in
`middleware/user.ts`:

1. Valid `profile` cookie for this user id: `ctx.state.user` comes from it. No
   KV.
2. Otherwise, with a `user_id` cookie: read KV once (the migration read) and
   set the cookie on the response, defaults included when there is no record.
   Returning visitors pay the old cost exactly once.
3. Neither: defaults in memory, no KV, no cookie until something is stored.

**Writes go to both, merged in KV.** `setUser` keeps writing KV, which stays
the durable copy for login sync and the e2e seed routes. It reads the KV record
and applies only the patch, because the cookie can be behind another device:
writing the whole cookie copy back would undo that device's changes. Page loads
stay KV-free; a write costs one read again. The middleware re-serialises the
cookie from the merged record after `ctx.next()` when `ctx.state.user` changed. Handlers mutate
`ctx.state.user` through `setUser` and never touch the cookie themselves; that
keeps one writer. Redirect responses have immutable headers, so clone them the
way `middleware/auth.ts` already does for `user_id`.

**Auth session joins the cookie.** On login the callback writes `userId` and
the session id into the signed profile payload. `middleware/auth.ts` takes the
user id from the payload when its `sessionId` equals the `auth_session` cookie,
and skips the KV read; the KV session record is kept and deleted on logout as
today. Logout also clears the `profile` cookie, so the next request re-seeds it
for the anonymous id. Revocation from another device is not a feature, so no
per-request check is lost.

**Theme in `_app.tsx`.** Unchanged: it reads `state.user.theme`, which is now
cookie-backed. The error page gets a theme too, which it loses today when
middleware throws before `user` runs.

## Migration

Lazy, backwards compatible, rollback-safe:

- Old clients have `user_id` only: step 2 above seeds the cookie on their next
  request. No one-shot job.
- Rolling back to code without this PR ignores the `profile` cookie and reads
  KV as before. KV was never behind.
- Cookie invalid or tampered: treat as absent, fall back to KV, re-sign.
- Email changes only through the auth callback, which rewrites the cookie.

Logged-in sync across devices is unchanged: login claims the user id from KV
and the next request seeds the cookie from the KV record.

**Devices converge within ten minutes.** Only a logged-in player can have two
devices on one account; an anonymous id is one browser. So anonymous visitors
never re-read, and a logged-in visitor's cookie is re-read from KV when its
`syncedAt` is older than ten minutes. A device switch (phone, then laptop
later) syncs on the laptop's first request; two devices in use within the same
ten minutes can disagree until the window passes. Skill level, streak and
calendar must agree across devices eventually, not instantly. A device's own
writes show immediately, since the cookie is re-issued from the merged record.
Email changes only in the auth callback, which clears the cookie. KV never
regresses, because writes merge the patch rather than the device's copy.

## Tests

- `lib/signed-cookie_test.ts`: round trip; a flipped byte in the payload or
  the tag is rejected; a payload signed with another secret is rejected. Pure
  code, test exhaustively.
- e2e integration: load `/` with a `user_id` cookie that has a KV record but no
  `profile` cookie, assert the response sets `profile`; load again, assert the
  theme renders without the record (delete it via the e2e user route between
  loads).

## Acceptance

`db.kv.*` spans: zero on any GET for anonymous visitors after their first
request; for logged-in visitors, at most one read per device per ten minutes. TTFB on `/puzzles/:slug` within 50 ms of
`/robots.txt`.

## Region note

Once this and `perf/progress-cookie` land, GET requests no longer touch
Virginia, and the app's region can move from `eu` to `global` so compute sits
next to the visitor. Before that, `global` would help only the static part and
leave the KV round trips as they are.

## Non-goals

- Removing KV user records. They remain the durable copy.
- Encrypting the cookie. The values are the user's own; signing stops forgery,
  which is the only risk.
