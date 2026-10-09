# Hint crawlers

## Problem

On 2026-10-09 between 05:00 and 11:00 UTC, isolates were killed 122 times for
exceeding their memory limit, with peak isolate memory around 680 MiB and CPU
spikes of several seconds.

The cause was a crawler following hint links. `hint_requested` ran at 200–290 an
hour, then 1,000–2,500 an hour through exactly that window. Every request had its
own `distinct_id`, none kept cookies, and they covered 258 puzzles and about
10,600 distinct move positions with almost no pageviews alongside. `robots.txt`
already disallows `/puzzles/*/hint` and `/puzzles/*?*`; this crawler ignores it.

Three things let it through:

- **The hint is a GET link.** The controls panel renders it as `<a href>` to a
  `GET` route, so anything that follows links triggers it. The route also has side
  effects (sets the hint cookie, increments the KV hint-usage counter), which GET
  shouldn't.
- **The hint limit lives in a cookie,** so a client without cookies never hits
  it.
- **Each hint is an expensive solve on the main thread.** `solveSync` runs inside
  the request handler with the default 10M-state budget. That blocks the isolate's
  only thread for the length of the solve, stalling every other request on it, and
  sits outside the per-isolate solve lock added for `/api/solve`.

`/puzzles/:slug/clone` has the same shape: a GET that writes a draft to KV for the
current user, and a cookieless client gets a fresh user per request.

## Approach

1. **Hint and clone become POST forms.** `<form method="post">` keeps both working
   without JavaScript (progressive enhancement holds), and crawlers don't submit
   forms. The hint dialog's client-side fetch switches to POST and keeps asking for
   JSON. The handlers move from `GET` to `POST`.
2. **Audit other links for side effects.** Find any other GET route reached by a
   plain link that writes state (KV, cookies, analytics) or does expensive work,
   and move it to a form request the same way.

   Outcome: nothing else needed moving. `/puzzles/build/reset` and
   `/candidate/edit` write drafts but are linked only from the dev-only
   candidate page. `/auth/login` writes an OAuth state, but it expires on a TTL
   and an OAuth start is a GET by convention.

The main-thread solve is fixed separately in `fix/hint-worker`, which moves hint
solves into the solver worker behind `solveLock`.

## Non-goals

- Blocking crawlers by user agent. POST removes what they can trigger; a
  user-agent list would be maintenance for no extra protection.
- Moving hint solving to the browser. It would remove the server cost, but the
  hint allowance is enforced server-side, so that's a separate product call.
- Caching hints by board. Worth it if real hint traffic grows, not needed to stop
  this.

## Open questions

- Is the KV hint-usage counter (`incrementHintUsageCount`) read anywhere that
  matters? Unlike PostHog insights, it counted every crawler hint.
- Every cookieless request creates a KV user record in the `user` middleware, so
  crawlers on any page write to KV. Per-visitor records are intentional, but it
  might be worth deferring the write until a visitor does something. Out of scope
  here.
