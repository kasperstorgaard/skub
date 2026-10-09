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
`{ v: 1, theme, skillLevel, name, email }` followed by `.` and an HMAC-SHA256
tag (Web Crypto, first 16 bytes, base64url) keyed by a new `COOKIE_SECRET`
env var. Signing matters because `skillLevel` gates the recommendation and
`email` must not be spoofable. `httpOnly`, `secure` outside dev, `SameSite=Lax`,
5 years, same as `user_id`.

Put the codec in `lib/signed-cookie.ts` (portable, no game knowledge) and the
profile shape in `lib/user-cookie.ts` next to the existing user id cookie.
Outside dev a missing `COOKIE_SECRET` is a startup error, not a silent
unsigned cookie.

**Middleware reads the cookie, falls back to KV once.** Order in
`middleware/user.ts`:

1. Valid `profile` cookie: `ctx.state.user` comes from it. No KV.
2. No cookie but a `user_id` cookie: read KV once (the migration read), set the
   cookie on the response. Returning visitors pay the old cost exactly once.
3. Neither: defaults in memory, no KV, no cookie until something is stored.

**Writes go to both.** `setUser` keeps writing KV, which stays the durable copy
for login sync and the e2e seed routes, and the middleware re-serialises the
cookie after `ctx.next()` when `ctx.state.user` changed. Handlers mutate
`ctx.state.user` through `setUser` and never touch the cookie themselves; that
keeps one writer. Redirect responses have immutable headers, so clone them the
way `middleware/auth.ts` already does for `user_id`.

**Auth session joins the cookie.** On login the callback writes `userId` and
the session id into the signed profile payload. `middleware/auth.ts` trusts a
valid signature and skips the KV read; the KV session record is kept and
deleted on logout as today. Revocation from another device is not a feature,
so no per-request check is lost.

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

One gap to decide deliberately: a logged-in user who changes theme or name on
one device keeps the stale cookie on another until they log in there again.
If that matters, add a `refreshedAt` claim and re-read KV for logged-in users
when it is older than a day: one read per device per day, none for anonymous
visitors. Theme and display name probably do not need it; email does not
change outside the callback.

## Tests

- `lib/signed-cookie_test.ts`: round trip; a flipped byte in the payload or
  the tag is rejected; a payload signed with another secret is rejected. Pure
  code, test exhaustively.
- `lib/user-cookie_test.ts`: profile encode/decode including optional fields;
  oversize name is truncated at the limit chosen (cookies cap at 4 KB).
- e2e integration: load `/` with a `user_id` cookie that has a KV record but no
  `profile` cookie, assert the response sets `profile`; load again, assert the
  theme renders without the record (delete it via the e2e user route between
  loads).

## Acceptance

`db.kv.*` spans: zero on any GET for anonymous visitors, zero for logged-in
visitors after their first request. TTFB on `/puzzles/:slug` within 50 ms of
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
