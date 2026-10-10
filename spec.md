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
`{ v: 1, id, sessionId?, skillLevel, theme, name, email }`, `.`, and a
base64url HMAC-SHA256 tag (Web Crypto, full 32 bytes so `crypto.subtle.verify`
does the constant-time compare) keyed by a new `COOKIE_SECRET` env var.
Signing matters because `skillLevel` gates the recommendation and `email` must
not be spoofable. `httpOnly`, `secure` outside dev, `SameSite=Lax`, 5 years,
same as `user_id`. A profile too large for a cookie (a pathological name) is
not set, and that visitor keeps reading KV.

The codec is in `lib/signed-cookie.ts` (portable, no game knowledge), the
profile shape in `lib/user-cookie.ts` next to the user id cookie. Outside dev a
missing `COOKIE_SECRET` is a startup error, not a silent unsigned cookie.

**The payload is bound to its user and login.** It is trusted only when `id`
matches the request's user id and `sessionId` matches the request's login
session (both absent when anonymous). Login and logout therefore re-seed the
cookie from KV on the next request, and a cookie left behind by an account
switch is ignored rather than believed. Neither the callback nor logout touch
the cookie.

**Middleware reads the cookie, falls back to KV once.** In
`middleware/user.ts`:

1. Trusted `profile` cookie: `ctx.state.user` comes from it. No KV.
2. Otherwise, a known visitor (`user_id` or login cookie): read KV once and
   seed the cookie, defaults included when there is no record. Returning
   visitors pay the old cost exactly once.
3. A brand-new visitor: defaults in memory, no KV, cookie seeded with them.

After `ctx.next()` the middleware re-encodes `ctx.state.user` and sets the
cookie when it differs from what came in. Handlers update `ctx.state.user`
through `setUser` and never touch the cookie; that keeps one writer.

**Writes merge in KV.** `setUser(userId, patch)` reads the record and applies
only the patch, because the request's copy can be behind another device:
writing it back whole would undo that device's changes. Page loads stay
KV-free; a write costs one read again.

**Logged-in identity from the cookie.** `middleware/auth.ts` takes the user id
from the profile when its `sessionId` equals the `auth_session` cookie, and
skips the `["auth_session", id]` read. The KV session record is kept and
deleted on logout as today. Revocation from another device is not a feature,
so no per-request check is lost.

## Migration

Lazy, backwards compatible, rollback-safe:

- Old clients have `user_id` only: step 2 above seeds the cookie on their next
  request. No one-shot job.
- Rolling back to code without this PR ignores the `profile` cookie and reads
  KV as before. KV was never behind.
- Cookie invalid or tampered: treat as absent, fall back to KV, re-sign.
- Email changes only through the auth callback; the login itself re-seeds the
  cookie.

Logged-in sync across devices is unchanged: login claims the user id from KV
and the next request seeds the cookie from the KV record.

**Devices sync at session start.** Only a logged-in player can have two devices
on one account; an anonymous id is one browser. A session is 30 minutes of
inactivity, as in PostHog: an unsigned `session` marker cookie with
`Max-Age=1800`, re-set on every response. A logged-in request without it is a
session start and re-reads the record from KV, re-issuing the cookie. A device
switch (phone, then laptop later) syncs on the laptop's first request; during
active play there are no reads. Two devices in active use at once may disagree
until one idles; that is not a real use case. Skill level, streak and calendar
must agree across devices eventually, not instantly. A device's own writes
show immediately, since the cookie is re-issued from the merged record. Email
changes only in the auth callback, and a login re-seeds the cookie. KV never regresses,
because writes merge the patch rather than the device's copy.

## Tests

- `lib/signed-cookie_test.ts`: round trip; a flipped byte in the payload or
  the tag is rejected; a payload signed with another secret is rejected. Pure
  code, test exhaustively.
- e2e integration in `routes/profile/_e2e/profile_test.ts`: a seeded player
  with a KV record and no `profile` cookie loads `/profile`, which sets the
  cookie; the record is deleted and the page reloaded, and their theme still
  renders.

## Acceptance

`db.kv.*` spans: zero on any GET for anonymous visitors after their first
request; for logged-in visitors, one read per session. TTFB on `/puzzles/:slug` within 50 ms of
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
