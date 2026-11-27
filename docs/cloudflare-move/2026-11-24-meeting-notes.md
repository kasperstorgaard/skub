# Cloudflare move — raw meeting notes, 2026-11-24

Raw notes from one long planning session (Kasper + Claude, with scout research).
Chronological, unpolished. Source material for the mission, north star
architecture, rollout plan and harness docs.

## Why we're moving

- Deno joined Cloudflare (announced 2026-10-09, completed Oct 8 per Cloudflare's
  10-Q, ~$26.5M). Deno Deploy shuts down ~April 2027. Deno runtime gets
  bug/security fixes for a year (Deno 2.9 LTS to ~Oct 2027), then development
  ends. Ryan Dahl + Bert Belder now merge Deno's celld (self-hosted Workers +
  DOs on object storage) into workerd.
- Fresh: no statement from anyone after the deal. Kasper: "it will not get
  maintained." Treat as dead.
- No official migration path: no Deno KV shim, no data tool, no Fresh adapter
  beyond a 4-step docs page.

## Principles (Kasper)

- Performance, server and client.
- Server first.
- Elegance/simplicity at a glance (complex under the hood is fine).
- Modern/bold — side project, can afford bold decisions.
- Later: "We want all the perf and all the offline and all the simplicity and
  all the server side" — half joking, but: the framework + Cloudflare tech that
  maximises these natively/elegantly is the choice.
- "You misunderstand how bold I am." Rewrite cost with agents on a small project
  doesn't matter.

## What the codebase actually depends on (inventory scout)

- Deno KV surface is small: `db/*.ts` (~800 lines), `db/kv.ts`,
  `lib/kv-json.ts`, backup/restore scripts, `/api/e2e/reset`. No route touches
  KV directly.
- KV features used: insert-if-absent (`versionstamp: null`), CAS retry loops
  (path groups, scores, 5 tries), multi-key atomics (solution under 4 index
  keys + group claim), `expireIn` (oauth_state), reverse ordered lists
  (highscore key encodes rank), `getMany` batches of 10. Not used: watch,
  enqueue, sum.
- Anonymous GETs: 0 KV ops (signed profile + progress cookies). Solve POST ~6–10
  ops. `/highscore` week view is the heaviest read (~7 lists of up to 1000
  solutions). Read-after-write matters on solve → solutions page.
- `candidates/` is NOT in KV — it's files on disk, dev-only tooling (TODO.md was
  wrong; fixed on this branch).
- Runtime couplings: `Deno.env` (~15 sites), `isDev` = "not on Deploy" in ~25
  files (needs an explicit app-env flag), runtime fs reads of puzzles and
  `danish-names.json`, `Deno.cron` hourly backup to GCS, Temporal (unstable
  flag, drives daily numbering), `node:zlib`.
- Solver: `new Worker(file://…)`, Semaphore(1). Hints allow 7M states, editor 3M
  (~175 MB measured). Workers caps memory at 128 MB/isolate → the real risk.
  `POST /api/solve` is public.
- OTEL: only `@opentelemetry/api`; Deploy provides the exporter. Off Deploy it
  silently no-ops.
- `posthog-node` has no flush — needs `waitUntil` on Workers.
- Fresh surface: `define.*` in ~40–45 route files, one `<Partial name="body">`
  in `_app.tsx`, `f-client-nav` ~4 places, `asset()` once. `islands/router.tsx`
  (74 lines) is custom and framework-free. 31–32 islands, plain Preact +
  signals. Only one shared file imports Fresh (`islands/solution-dialog.tsx`).
- Tests: 45 `*_test.ts`, ~500–550 `Deno.test`, plain `@std/assert`, no steps, no
  FakeTime. E2E: Playwright library inside `Deno.test`, blast-radius selector.
  CI depends on Deploy's `deployment_status` events.
- Corpus: 340 puzzle files, all gzip to 22 KB together. Today is #328; 8
  numbered puzzles unreleased. Puzzle page HTML ~6 KB gz (perf audit).

## Platform facts (Cloudflare scout, + later research)

- Workers paid: 30 s CPU default (max 5 min), 128 MB memory, 10k subrequests.
- DO SQLite: 10 GB/object, ~1,000 req/s soft limit per object, `locationHint`
  (best effort, set on first get, objects never move) or `jurisdiction("eu")`
  (hard, permanent). Declarative `exports` replaced `migrations` (2026-06-30).
- D1: read replicas via Sessions API + bookmarks; batch is a transaction but no
  read-then-decide inside.
- **Worker Previews (2026-09-22):** one preview per branch, each gets its own DO
  namespace + storage automatically. KV/D1/R2 shared unless bound separately.
  Cron + routes target production only.
- OTLP export to external collectors (HTTP/JSON); PostHog accepts logs only, not
  traces.
- Cron triggers: 15 min CPU for hourly+ schedules — backup fits.
- `cf` CLI (open beta, 2026-09-28): Wrangler's successor, generated from the
  full API, `cloudflare.config.ts`, Vite-based. Wrangler gets 18 months after
  the beta ends. Vite plugin v2 is beta and deploys via `cf`.
- Speed Brain won't prefetch Worker routes. Early Hints works with Workers.

## Cloudflare's direction (research)

- Acquisitions: Baselime (2024), Outerbase + Arroyo (Apr 2025), Replicate (Nov
  2025, close unconfirmed), **Astro (2026-01-16)**, **VoidZero —
  Vite/Vitest/Rolldown/Oxc/Vite+ (2026-06-04)**, **Deno (2026-10-09)**. PartyKit
  (2024) unverified.
- Thesis: Vite as the neutral full-stack foundation; Astro for content/islands;
  vinext (Next.js on Vite, 1.0 2026-09-28) as the Next escape hatch; EmDash
  (Astro CMS, Cloudflare's own blog runs on it); workerd + DO made
  self-hostable; agents as first-class platform users.
- People: Dahl/Belder/Varda on self-hostable workerd; Evan You wants Vite as a
  full-stack foundation; Fred K. Schott on Astro moving faster inside
  Cloudflare; Sunil Pai on Agents SDK / Project Think. Adam Argyle left Chrome
  in 2025 (current employer unverified), into view transitions, scroll-driven
  animations, Open Props. Surma is at Shopify, nothing recent on Wasm. No
  statements on Preact/Solid/Fresh.
- Bun is owned by Anthropic (Dec 2025).

## Decisions, in the order they were made

1. **Host + runtime: Cloudflare Workers (workerd)** as the main runtime.
2. **Store: one SQLite Durable Object** holding everything. Solve = one
   `transactionSync` (insert solution once, unique index dedup, path claim,
   award score). Four solution copies collapse to one row + indexes; paths and
   highscore become SQL. No versionstamps, no retries. D1 = fallback. Workers KV
   out (no atomics, eventually consistent).
3. First plan was layered on `main` with Fresh as a bridge. **Replaced:** Kasper
   — "Could just start the transition in parallel and swap when I am satisfied
   with the move (double CI until then)." → **Parallel rebuild** in the same
   repo, new app in its own Bun workspace, shared pure code imported (not
   copied), two CI pipelines, no bridge.
4. **Toolchain: Bun** ("I would like to try bun if at all feasible") for
   installs, scripts, `bun test`; Vite 8, Oxlint + Oxfmt, TypeScript 7. Vitest
   is the fallback test runner. Vite+ dropped (manages Node, competes with Bun).
   Note: VoidZero is now Cloudflare-owned.
5. **Framework: Astro 6 + Preact islands** (`@astrojs/preact`,
   `@astrojs/cloudflare`). Pages are thin `.astro` shells; components/islands
   stay TSX. Shared signals → one island root per page that owns them. Own
   `?dialog=` router stays; `ClientRouter` replaces Partials (view transitions).
   DO exported from `src/worker.ts` next to the adapter's `handle()`.
   - Rejected: Fresh on workerd (unmaintained), Fresh fork (dead upstream),
     Remix 3 (shipped Oct 2026 but no `@preact/signals`, Node-only tooling, beta
     Workers path), HonoX (alpha), React-based (RR7, TanStack Start, RedwoodSDK,
     vinext — JS budget), SvelteKit (most native service worker, but adapter
     can't export a DO, dev via `getPlatformProxy`, whole-route hydration), Qwik
     (dropped its service worker, 2.0 still RC), Mastro (0.1.x, renders in the
     SW), SolidStart (not researched).
   - Solid islands inside Astro was raised; Kasper chose **Preact**.
   - Fallback: own thin layer (Hono + Vite + Preact, ~800 lines).
6. **Platform CLI: `cf`** (for now), Vite plugin v2. Wrangler only where `cf`
   lacks something (e.g. per-branch previews if `cf` can't yet).
7. **Rust: only for the solver, if its spike wins.** Rust → WASM inside the
   Worker, packed states in a compact hash set, checked against `game/solver.ts`
   on all shipped puzzles. Rest of the server stays TS (I/O-bound, shares
   types/rules with islands). No separate Rust API.
8. **No serverless functions / no Node server:** one Worker serves pages, form
   POSTs, API endpoints, middleware and the cron; the DO is a class in the same
   codebase. Astro Actions skipped (JS-first).
9. **Offline-first is in scope** ("I like the idea of incorporating offline
   first in this revamp"; "might force some good architecture decisions").
   - Server-rendering in the service worker: rejected (Safari lacks SW
     cookieStore, signing key can't ship, no framework support).
   - Local SQLite (WASM + OPFS) as client DB: possible, rejected for now — tiny
     per-player data, shared data can't go offline, heavy, second source of
     truth.
   - Sync engines (Zero, LiveStore): client-first, break no-JS.
   - Offline doesn't tip the framework choice; slightly favours SQLite on the
     server (same dialect if a client mirror ever comes).
10. **Write model** (forced by offline): self-contained requests (server
    verifies by replaying moves); one endpoint per write for form POST, fetch
    and replay; replay-safe via client-made id + unique indexes; client
    predicts, server confirms; online-only is a short named list (hints, login,
    editor solve).
11. **Outbox = a queue of requests**, owned by the service worker (Kasper: "it
    should be a queue of requests, for simplicity"). Stored in **IndexedDB via
    `idb-keyval`** ("too custom" for the Cache-API-as-KV trick; "tiny idb
    instead"). The one exception to "server-set cookies only". Replay in order
    on `online` and next navigation; Background Sync as a Chromium bonus; 2xx
    clears, 4xx drops, network/5xx keeps. Replays carry current cookies;
    `Set-Cookie` updates progress. Path claims by server receipt (late solves
    quietly miss the claim).
12. **Offline scope flipped to "cache everything released"** after the numbers
    came in: ~330 pages × ~6 KB gz ≈ 2 MB. Hand-written service worker (~150
    lines; not Workbox/`@vite-pwa/astro`), build-time manifest (hashed assets,
    released puzzle URLs, version). HTML network-first with ~300–500 ms timeout,
    assets cache-first with old versions kept while cached pages reference them,
    lazy refresh after deploys. Idle + good connections only, never Save-Data;
    `navigator.storage.persist()`. `/offline` lists cached puzzles
    (`caches.keys()` is queryable from the page too).
    - Discussion before the flip: intermittent vs longer offline. Longer needs
      cross-page progress, offline recommendations, daily rollover — the flip
      solves the recommendation part.
    - Client-side rendering of puzzles from cached data: rejected ("too
      custom"); cache the server's HTML and let `ClientRouter` fetch through the
      SW instead.
13. **"Play next" (`/puzzles/recommended`, pseudo-random) becomes a concrete
    link** rendered by the server, not a redirect: works without JS, saves a
    round trip, lands on a cached page offline.
14. **Caching:**
    - Edge-cache shared DO query results (top highscore entries + names, path
      groups), 30–60 s + SWR. Not HTML — `/highscore` and solutions pages are
      personalised (viewer's row, own solutions).
    - Puzzle pages not edge-cached: they're "90% cacheable", but the uncached
      path has no store call, so a hit saves only render CPU. Revisit with
      HTMLRewriter (cached shell + player parts from cookies) if the spike shows
      render > ~20 ms. Server islands rejected (need JS).
    - Static pages prerendered at build. Early Hints for CSS + fonts. Astro
      prefetch / Speculation Rules for the likely next page.
15. **DB placement: closest to the user "if not too complex to replicate"** →
    one DO with `locationHint: "weur"`, no replication. The design already keeps
    the DB off the critical path (cookie renders at the edge, edge-cached shared
    reads, optimistic solves). Revisit if non-EU traffic grows.
16. **SQL tests:** "some, but don't start testing SQL lib, more like
    integration" → store code takes a minimal `exec(sql, ...params)` interface,
    a handful of scenario tests on in-memory `bun:sqlite`.
17. **No feature freeze** ("don't see the need really"). Two rules instead: a
    change to stored data on the Deno app maps itself into the import + schema
    in the same PR; UI changes land in shared code or get ported with their
    flow.
18. **Transition mechanics** (Kasper: "parallel builds, a data transfer/backup
    one way and a feature flag/separate url. Then I can switch when the bugs are
    eradicated"):
    - `next.skub.app` on the new Worker.
    - One-way, idempotent import cron from the hourly GCS backup (bots dropped,
      `INSERT OR IGNORE`, scores rebuilt). Log in on `next` to see the real
      account (auth sub→userId moves with the data). Writes on `next` stay
      there.
    - Switch when bug-free: read-only window → final import → verify counts →
      DNS. Rollback = DNS back, loses only post-switch writes.
    - Separate URL chosen over a routing-Worker feature flag on `skub.app` (no
      extra hop or moving part in front of prod).
    - Same `COOKIE_SIGNING_KEY` so signed cookies survive. Auth sessions may
      drop (one re-login).

## Open

- Solver: compact TS or Rust → WASM (spike decides).

## Spikes (step 0, throwaway)

- Astro 6 on workerd under `bunx --bun astro dev` / build: page, island imported
  from outside the app dir, `ClientRouter` + `?dialog=` router, no-JS POST →
  303, streamed solve. Single Preact instance; Tailwind `@source` for shared
  dirs; JS ≤ 40 KB puzzle / 25 KB home; puzzle page render time.
- `cf` + Vite plugin v2 + Astro adapter: build, dev in workerd, deploy,
  per-branch preview with own DO storage (else `wrangler preview`).
- Service worker + `ClientRouter` offline: 20 cached pages, offline nav,
  uncached page → `/offline`, view transitions, old tab survives a deploy.
- DO entrypoint on Astro 6: `src/worker.ts`, `deleteAll()` reset, Vite 8 + `cf`
  compatibility.
- Shared signals audit → one island root per page.
- Solver: CPU + peak memory on the hardest puzzles and a budget-exhausting
  editor board; outcomes fits / compact TS / Rust → WASM / lower budget.
- DO round trip from Denmark on a preview.
- Bun + Playwright + `bun test` on shared tests.

## Side notes

- Perf budgets carried over: GET TTFB ≤ 150 ms warm from EU, solve POST ≤ 400
  ms, JS ≤ 40 KB gz puzzle / 25 KB home, CSS ≤ 14 KB gz.
- Unreleased puzzles must never ship publicly (static files today serve them;
  bundling at build fixes that; SW precache must exclude them).
- `idb-keyval` was already in `deno.json`, unused.
- Memories updated: Deno EOL (stack chosen), cookies rule (IndexedDB outbox
  exception), no-KV-unit-tests (new app nuance).
