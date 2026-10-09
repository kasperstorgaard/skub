# Perf baseline and KV tracing

First PR of the perf roadmap (see the `perf/*` branches). It records the
measured baseline, sets the budgets every later PR is judged against, and adds
the one instrument that was missing: spans on KV calls.

## Problem

The app is server-rendered, pages are 5–6 KB compressed, and yet real users
wait. PostHog `$web_vitals`, real browsers only, 30 days to 2026-10-09:

| Page            | FCP p50 | FCP p75 | n   |
| --------------- | ------- | ------- | --- |
| `/`             | 1580 ms | 2456 ms | 69  |
| `/puzzles`      | 1209 ms | 1446 ms | 23  |
| `/puzzles/:slug`| ~950 ms | ~1200 ms| 10–18 each |

By continent (90 days): EU p50 988 ms, NA 1077 ms, OC 1654 ms. Traffic is 1139
pageviews from 20 people in 30 days, all client-captured; crawlers never
produce pageviews or vitals, so these numbers are humans.

Warm TTFB measured with curl from Denmark on 2026-10-09, four samples each:

| Request                      | TTFB        | KV round trips |
| ---------------------------- | ----------- | -------------- |
| `/robots.txt` (static)       | 55–130 ms   | 0              |
| `/puzzles/:slug`             | 276–298 ms  | 2              |
| `/puzzles` (archives)        | 287–354 ms  | 2              |
| `/puzzles/:slug/solutions`   | 279–300 ms  | 2–3            |
| `/` returning visitor        | 286–333 ms  | 2              |
| `/` new visitor (no cookies) | 528–663 ms  | 3              |

The isolate runs in Amsterdam (`via: ams.vultr.prod.deno-cluster.net`). Deno KV
is replicated only within Northern Virginia. Every KV call is therefore a
transatlantic round trip of roughly 110 ms, and the pages run them
sequentially: `middleware/user.ts` reads the user record, then the handler
lists solutions. A new visitor pays a third for the record write. The solve
POST runs about nine in sequence.

Cold starts are not the issue: importing the built server bundle takes 55–70 ms
locally, and the four real-user samples after a ten-minute idle gap were not
slower than warm ones.

None of this is visible in the Deno console today. Routes have spans
(`home.solutions`, `puzzle.save_solution`) but KV calls do not, so a slow
request shows as a slow request.

## Budgets

The yardstick for the whole roadmap. "Warm" means an isolate that served a
request in the last minute, measured from Europe.

| Metric                                    | Today          | Budget   |
| ----------------------------------------- | -------------- | -------- |
| GET TTFB, warm, any page, any visitor     | 280–660 ms     | ≤ 150 ms |
| KV round trips on a GET                   | 2–3            | 0        |
| FCP p75, `/` and `/puzzles/:slug`         | 2.5 s / 1.2 s  | ≤ 1.0 s  |
| JS on `/puzzles/:slug`, gzipped           | ~95 KB         | ≤ 40 KB  |
| JS on `/`, gzipped                        | ~77 KB         | ≤ 25 KB  |
| CSS, gzipped, render-blocking             | 20.2 KB        | ≤ 12 KB  |
| Hashed assets and fonts cached immutable  | CSS only       | all      |
| Solve POST, warm                          | ~1 s (9 RTT)   | ≤ 400 ms |

## Approach

Instrument KV in one place. Wrap the `kv` export in `db/kv.ts` so `get`,
`getMany`, `set`, `delete`, `list` and `atomic().commit()` each run inside a
child span named `db.kv.<op>`, with `kv.key_prefix` (the first key segment, a
string) as the only attribute. Keys carry user ids, so never record the full
key.

On the request's active span, add `kv.ops` and `kv.ms` so the console can sort
requests by KV cost without opening a trace. A per-request counter needs
request scope: keep it on the OTEL context (a context key set in
`middleware/telemetry.ts`, read by the wrapper), not on a module global, or
concurrent requests share one counter.

Span naming follows `/observability`: `db.kv.get`, `db.kv.list`,
`db.kv.commit`. No verbs beyond the op itself.

## Tests

The wrapper is a thin third-party wrapper, which `/testing` says not to unit
test. Verify in the Deno console: one trace for `/` as a new visitor should
show three `db.kv.*` spans, each around 100 ms, in sequence.

## Non-goals

- Changing any read or write pattern. That is the next PRs' job; this one only
  makes them measurable.
- Instrumenting `getPuzzle` file reads. They are sub-millisecond.

## Hygiene findings

Recorded here so the audit survives in `specs/`. Each belongs to the PR named,
or to none.

- `db/`, `middleware/`, `game/loader.ts`, `game/recommendation.ts`,
  `game/cookies.ts`, `lib/tracking.ts` have no unit tests. `recommendation.ts`
  is pure given its inputs and gets tests in `perf/progress-cookie`.
- `middleware/auth.ts` and `middleware/user.ts` skip `/api/migrate`, a route
  that does not exist. Drop in `perf/kv-read-path`.
- `db/user.ts#setUser` reads before every write, and the solve POST calls it
  twice. `perf/kv-read-path` and `perf/solve-post`.
- `db/stats.ts#incrementHintUsageCount` retries without a bound.
- `listUserSolutions({ limit: "max" })` scans up to 10,000 entries on every
  home, archives and profile GET. Replaced by `perf/progress-cookie`.
- `routes/puzzles/[slug]/solutions/index.tsx` uses `useMemo` and `useSignal`
  in a page that has no island reading them.
- `islands/cookie-banner.tsx` has no client behaviour (plain form POST) and
  should be a component. `perf/client-budget`.
- The `middleware/user.ts` doc comment names `ctx.state.theme` and
  `ctx.state.email`, which do not exist. The `islands/tracking-script.tsx`
  comment says pageviews are captured server-side; they are client-side only.
- `game/loader.ts#getPuzzle` parses the markdown on every request while the
  manifest next to it is cached. `perf/kv-read-path`.
