# Mission

Rebuild Skub on Cloudflare as a server-first app that is fast everywhere, works
without JS and offline, and reads simply. Run it beside the Deno app on
`next.skub.app`, and make the switch when it is bug-free on real data.

## Product north star

What Skub is, beyond the move. Every feature is weighed against it; the
[architecture north star](architecture.md) is how it's built.

- **Server side.** Pages render on the server. The client only enhances.
- **Accessible.** Including without JS: every core flow works with JS off.
- **Fast.** Quick first byte, small pages, little JS.
- **CSS and the web platform first.** Lean into what browsers do natively before
  reaching for JS.
- **Offline as a first-class citizen.**
- **Free to play.**
- **Anonymous as a first-class citizen.** Everything works without an account;
  logging in only adds.
- **Honest.** No dark UX patterns.

### Tone of voice

- Friendly.
- Funny, joking.

## Why we're moving

- Deno joined Cloudflare (announced 2026-10-09). Deno Deploy shuts down around
  April 2027. The Deno runtime gets bug and security fixes until about October
  2027 (Deno 2.9 LTS), then development ends.
- Fresh has had no statement from anyone since the deal. Kasper: "it will not
  get maintained." We treat it as dead.
- There is no official migration path: no Deno KV shim, no data tool, no Fresh
  adapter.

So Skub needs a new runtime, host, store, framework and toolchain. The hard
deadline is Deno Deploy's shutdown. The port is planned at about a month, with
the Deno app shipping only puzzles and bug fixes meanwhile.

## Principles

1. **Performance, server and client.** Fast first byte, small pages, little JS.
2. **Server first.** Pages render on the server from the request. The client
   only enhances.
3. **Simple at a glance.** The shape of the app is obvious from the outside.
   Complexity under the hood is fine.
4. **Bold.** It's a side project. Rewrite cost with agents on a small project
   doesn't matter. Kasper: "You misunderstand how bold I am."

Half joking, but the yardstick: "We want all the perf and all the offline and
all the simplicity and all the server side." The tech that gives the most of
these natively wins.

## Goals

Each goal is checked on `next.skub.app` before the switch, and again after it.

### Performance budgets

| Measure                        | Budget                                              |
| ------------------------------ | --------------------------------------------------- |
| GET TTFB, warm, from EU        | ≤ 150 ms                                            |
| Solve POST                     | ≤ 400 ms                                            |
| JS, puzzle page                | ≤ 40 KB gz (the lazy-loaded solver doesn't count)   |
| JS, home                       | ≤ 25 KB gz                                          |
| CSS, entry                     | ≤ 16 KB gz                                          |
| CSS, per theme                 | ≤ 6 KB gz                                           |
| Service worker cost            | ≤ 5 KB gz added to the puzzle page; nothing on home |
| Puzzle page render, in workerd | Above ~20 ms, revisit edge-caching the page shell   |

### Offline

- Every released puzzle page is cached in the background (~330 pages, ~2 MB).
  Once cached, any of them opens and plays offline.
- A solve made offline is kept on the device and synced when back online. The
  player stays in place; offline Home is the way around.
- Hints and the editor solve run in the browser, so they work offline. Login
  needs a connection.

### Works fully without JS

Every flow works without JS: play, solve, name, Flash, feedback, profile,
consent. The exceptions are the editor, as today, and hints, which are computed
in the browser.

### Anonymous-first

- No account is needed to play, solve or appear on the high score.
- An anonymous GET makes no store call. It renders from signed cookies and
  bundled puzzles.
- Login stays optional and only carries a player's history across devices.

### Data moves whole

Every player with a solution or a login moves, with their solutions, scores,
ratings, feedback and login. Solution, player and score totals match the Deno
app's at the switch. The ~1M bot `user` records stay behind.

## The switch criterion

The switch happens when the bugs are gone, not on a date:

- `next.skub.app` has run bug-free on real, near-live data.
- Each app's e2e suite passes, and the copies are in parity.
- Every row in [parity.md](parity.md) is ported, or marked not kept. That
  includes local flows: the dev-only authoring tool moves before the switch.
- The perf budgets above hold on `next.skub.app`.

## Non-goals

- Redesigning game rules or UI during the move. Ports first, then improvements.
- Redesigning data beyond what SQL makes natural.
- Migrating bot `user` records.

See [architecture.md](architecture.md) for the end state,
[rollout.md](rollout.md) for the steps, and [decisions.md](decisions.md) for
why.
