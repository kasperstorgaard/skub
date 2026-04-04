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

## Solution

### 1. `lib/tracing.ts` — span helper

Single exported function `withSpan(name, fn)`. Creates a child span under the
active context, runs `fn(span)` so the caller can set attributes, ends the span
on completion, records exceptions on error.

```ts
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
): Promise<T>
```

Uses a module-level `trace.getTracer("skub")`. No config needed — Deno Deploy
injects the provider; the tracer name just labels spans in the trace UI.

### 2. Home page instrumentation (`routes/index.tsx`)

Wrap the parallel fetch and the sequential step as sibling child spans:

- `home.fetch` — wraps `Promise.all([getLatestPuzzle, listUserSolutions, getUserStats])`
  - attribute: `solutions.count` — number of solutions returned (key signal for scan cost)
- `home.random_puzzle` — wraps the `getPuzzle`/`getRandomPuzzle` call
  - attribute: `user.onboarding` — which branch was taken

Also set on the active span:
- `puzzle.slug` for the daily puzzle slug

### 3. Puzzle POST instrumentation (`routes/puzzles/[slug]/index.tsx`)

Add attributes to the active span for request-level context:
- `solution.source` — `"auto"` vs `"manual"` (from form field)
- `solution.moves` — move count

Wrap the two sequential KV operations as child spans:
- `puzzle.set_user` — wraps `setUser(...)`
- `puzzle.save_solution` — wraps `saveSolution(...)`
  - attributes: `solution.is_new`, `solution.is_new_path`

If `puzzle.save_solution` shows as the bottleneck in traces, a follow-up adds
internal spans inside `saveSolution` itself (dedup scan, atomic commit,
aggregate updates). Keeping that out of scope for now to avoid coupling OTEL
into `db/`.

## Files

- **new** `lib/tracing.ts` — `withSpan` helper, module-level tracer
- **modified** `routes/index.tsx` — `home.fetch` + `home.random_puzzle` child spans
- **modified** `routes/puzzles/[slug]/index.tsx` — active span attributes + `puzzle.set_user` + `puzzle.save_solution` child spans
