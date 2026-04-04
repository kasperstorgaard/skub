# OTEL instrumentation for home page and puzzle submit

## Problem

Two paths have suspected perf issues with no timing visibility:

**Home page GET** — three operations run in parallel, then `getRandomPuzzle`
runs sequentially after. `listUserSolutions(limit: 500)` is a full KV scan that
could dominate. Can't tell from a single request span which step is slow.

**Puzzle POST** — `setUser` and `saveSolution` run sequentially despite being
independent. `saveSolution` itself has 3+ sequential KV round trips:
`getCanonicalUserSolution` (list scan up to 100 entries), `kv.get(groupKey)`,
`atomic.commit()`, then `updatePuzzleStats` + `updateCanonicalGroup` in parallel.
No visibility into where time goes.

**Auto-solve chain** — client-side solve triggers three server requests
(POST puzzle → GET puzzle page → GET celebrate-stats) that appear as unlinked
traces with no way to correlate them.

## Solution

### 1. `lib/tracing.ts` — span helpers

`withSpan(name, fn)` — creates a child span under the active context, runs
`fn(span)` so the caller can set attributes, ends the span on completion,
records exceptions on error.

`getTraceparent()` — injects the active span context into a W3C carrier and
returns the `traceparent` header value. Used server-side to embed the trace
context into rendered HTML.

```ts
export function withSpan<T>(name: string, fn: (span: Span) => Promise<T> | T): Promise<T>
export function getTraceparent(): string | undefined
```

### 2. Home page instrumentation (`routes/index.tsx`)

Fetch solutions once and share between `getUserStats` and `getBestMoves` to
avoid a double KV scan. Wrap the parallel fetch and the sequential step as
sibling child spans:

- `home.fetch` — wraps `Promise.all([getLatestPuzzle, listUserSolutions])`
  - attribute: `solutions.count` — number of solutions returned (key signal for scan cost)
- `home.random_puzzle` — wraps the `getPuzzle`/`getRandomPuzzle` call
  - attribute: `user.onboarding` — which branch was taken

### 3. Puzzle POST instrumentation (`routes/puzzles/[slug]/index.tsx`)

Add attributes to the active span for request-level context:
- `solution.source` — `"auto"` vs `"manual"` (from form field)
- `solution.moves` — move count

Parallelize `setUser` and `saveSolution` (were sequential, no dependency).
Wrap both as child spans:
- `puzzle.set_user` — wraps `setUser(...)`
- `puzzle.save_solution` — wraps `saveSolution(...)`
  - attributes: `solution.is_new`, `solution.is_new_path`

If `puzzle.save_solution` shows as the bottleneck in traces, a follow-up adds
internal spans inside `saveSolution` itself. Out of scope for now to avoid
coupling OTEL into `db/`.

### 4. W3C trace context propagation

Links the three-request auto-solve chain into a single connected trace:

1. `routes/_app.tsx` — injects `<meta name="traceparent" content="...">` into
   every server-rendered page `<head>` via `getTraceparent()`
2. `client/tracing.ts` — `addTraceParentHeader(headers)` reads the meta tag and
   sets the `traceparent` header on outgoing fetches
3. `islands/auto-post-solution.tsx` — passes the header on the solution POST
4. `islands/celebration-dialog.tsx` — passes the header on the celebrate-stats fetch

Deno Deploy's auto-instrumentation reads the incoming `traceparent` header and
starts each handler span as a child of the page span, linking all three requests.

## Files

- **new** `lib/tracing.ts` — `withSpan` + `getTraceparent`, module-level tracer
- **new** `client/trace-context.ts` — `addTraceParentHeader` for client-side fetches
- **modified** `routes/_app.tsx` — injects `<meta name="traceparent">` in `<head>`
- **modified** `routes/index.tsx` — `home.fetch` + `home.random_puzzle` child spans, shared solutions list
- **modified** `routes/puzzles/[slug]/index.tsx` — active span attributes + parallelized `setUser`/`saveSolution` + child spans
- **modified** `islands/auto-post-solution.tsx` — passes `traceparent` header on POST
- **modified** `islands/celebration-dialog.tsx` — passes `traceparent` header on celebrate-stats fetch
