# State & data flow

## Decision order

Pick the first that fits:

1. **URL** — temporary core state, shareable (e.g. puzzle moves)
2. **Cookie** — per-user state, non-essential (e.g. completed puzzles)
3. **Static** — immutable data baked at build time (e.g. puzzles)
4. **KV** — shared across users, no auth needed (e.g. solutions)
5. **Signal** — client-only ephemeral state, never persisted

## URL state

First important part is the route itself, handled by fresh

Then comes the [slug], which tells us the currently active puzzle

Then comes the game interactions as query params. Every game interaction the
user does should be reflected in the url. This means it is safe, shareable,
recoverable and easy to reason about.

Moves are encoded using chess notation A1-H7

## Cookies

Everything tied to a single user gets stored in cookies. Given the nature of
cookies, this cannot be essential for their experience, but rather an
enhancement. Fx. a list of which puzzles the user has completed: fine for
cookies, you can easily play the game without it.

## Self-contained requests

A page should be renderable from what arrives with the request (cookies, URL)
plus static data. The durable store is written to; it is not waited on while
answering a GET. Waiting on a remote store per request is what makes a
server-rendered page feel slow, and most visitors have no account anyway.

For per-user state that should also follow a login to another device (profile,
progress) this means two copies with different jobs: the cookie is what a
request reads, KV is the durable copy that writes go to and that a login
rebuilds the cookie from.

Why this works well here:

- **The request has everything it needs on arrival.** No store round trip stands
  between the request and the first byte.
- **It keeps the anonymous-first model.** No account is needed for the cookie to
  work, and when someone does log in, KV is where their state waits for the next
  device.
- **Degradation is graceful.** A missing, stale or tampered cookie is treated as
  absent: rebuild it from KV once and carry on. Nothing is lost, because KV
  always has the full copy.
- **It migrates itself.** Old clients get the cookie on their next request;
  rolling back ignores the cookie and reads KV as before.

Two constraints come with it: sign anything that gates behaviour so it cannot be
forged, and keep the encoding compact, since cookies are small and travel with
every request.

## Deno KV

Anything that needs to be shared between users. Given we don't have sign in,
this data is not guaranteed unique or anything. fx: "The same user can create
multiple solutions with different names? fine"

## Preact Signals

The big client side progressive enhancement, is that each interaction with the
game does not require a full page reload. This is achieved by passing the core
game state down from server to client islands using signals. These are then
modified, which updates the url state client side on the fly.
