# North star architecture

The end state of Skub on Cloudflare, described as if it exists. PRs on the new
app are reviewed against this doc. Reasons and rejected options live in
[decisions.md](decisions.md); the order of work lives in
[rollout.md](rollout.md).

## At a glance

| Concern        | What we use                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| Runtime + host | Cloudflare Workers (workerd). One Worker serves everything.                                                           |
| Store          | One SQLite-backed Durable Object (DO), `locationHint: "weur"`                                                         |
| Framework      | Astro 6 + `@astrojs/preact` + `@astrojs/cloudflare`. Thin `.astro` page shells, TSX components and islands.           |
| Client state   | Preact islands + signals. One island root per page that has shared state. Own `?dialog=` router. `ClientRouter`.      |
| Puzzles        | Bundled at build time as a generated module                                                                           |
| Static assets  | Workers Static Assets                                                                                                 |
| Offline        | Hand-written service worker: caches every released puzzle page, plus an outbox for writes in IndexedDB (`idb-keyval`) |
| Caching        | Edge cache for shared DO query results. Static pages prerendered. Early Hints. Prefetch.                              |
| Solver         | Runs inside the Worker. TypeScript or Rust → WASM, decided by a spike.                                                |
| Cron           | Cron Triggers: hourly backup; the import cron until the switch                                                        |
| Observability  | OTLP export to an external backend. PostHog via `waitUntil`, `/ph` proxy.                                             |
| Platform CLI   | `cf` with `cloudflare.config.ts` and `@cloudflare/vite-plugin` v2. Wrangler only where `cf` lacks a feature.          |
| Toolchain      | Bun (installs, scripts, `bun test`), Vite 8, Oxlint + Oxfmt, TypeScript 7                                             |
| Previews + e2e | One Worker Preview per branch, each with its own DO storage. `@playwright/test` against it.                           |

## Invariants

Reviewers check these on every PR.

- **An anonymous GET makes no store call.** Pages render from the URL, signed
  cookies and bundled puzzles.
- **Every flow works without JS,** except the editor.
- **Every write is one endpoint** that serves a no-JS form POST (303), an
  island's fetch and an outbox replay, with the same fields.
- **Every write is replay-safe:** a client-made id plus a unique index.
- **Cookies are set by the server.** The outbox in IndexedDB is the one
  exception.
- **The HTML is always the server's.** The service worker caches pages; it never
  renders them.
- **Unreleased puzzles never ship publicly:** not as static files, not in the
  service worker precache.
- **Shared code is imported, never copied.**
- **Redirects are 303.**

## Runtime and host

- One Worker on Cloudflare Workers (workerd) serves pages, form POSTs, API
  endpoints, middleware and the cron.
- The DO is a class in the same codebase, exported from `src/worker.ts` next to
  the Astro adapter's `handle()`.
- There is no Node server and no separate serverless function.
- Workers limits that shape the design: 128 MB memory per isolate, 30 s CPU by
  default (max 5 min), 10k subrequests. Cron triggers on hourly or slower
  schedules get 15 min CPU.
- Environment comes from one env module. An explicit app-environment flag
  replaces today's `isDev` ("not on Deploy"). Secrets are Worker secrets.
- `COOKIE_SIGNING_KEY` is the same key the Deno app uses.
- Temporal comes from a polyfill where the runtime lacks it.

## Store

One SQLite-backed Durable Object is the whole database.

- **Placement:** `locationHint: "weur"`, set on first get. Objects never move.
  No replication.
- **Tables:** user, solution, score, user_score, feedback, rating and auth.
  - A solution is one row. Today's four KV copies (by puzzle, by user, by user
    and puzzle, by canonical path) are indexes on that row.
  - Path groups are a SQL query over solutions.
  - The high score is a ranked SQL query over scores.
  - The auth table keeps the Auth0 `sub` → `userId` mapping.
- **The solve is one `transactionSync`:** insert the solution once (a unique
  index dedups), claim the path, award the score. No versionstamps, no retry
  loops, no best-effort follow-up writes.
- **Migrations** run on `PRAGMA user_version`.
- **Access:** store code takes a minimal `exec(sql, ...params)` interface. On
  top of it sit typed SQL helpers or Drizzle's durable-sqlite driver (open).
- **Tests:** a handful of scenario tests at the level of store operations, run
  on in-memory `bun:sqlite`. They don't test the SQL library or each query.
- **Limits:** 10 GB per object, ~1,000 req/s soft limit per object. Skub's write
  rate is far below that. If a measured limit appears, shard: drafts first, then
  by puzzle.

## Framework and rendering

- **Astro 6** with `@astrojs/preact` and `@astrojs/cloudflare`. Workerd runs in
  dev, prerender and production.
- **Pages are thin `.astro` shells.** Components and islands stay TSX.
- **One island root per page with shared state.** Astro islands don't share
  signals. A page whose islands share state (the puzzle page) gets one island
  root that owns the signals and renders the board and dialogs as ordinary
  children.
- **Skub's own `?dialog=` router** opens and closes dialogs.
- **`ClientRouter`** handles client navigation and view transitions. It replaces
  Fresh Partials. Its fetches go through the service worker.
- **Static pages** (cookie policy and similar) are prerendered at build.
- **Puzzles are bundled at build time** as a generated module. No runtime disk
  reads. Names (`danish-names.json`) load the same way.
- **"Play next" is a concrete link.** The server renders the pseudo-random
  recommendation as `/puzzles/<slug>`, not a link to the `/puzzles/recommended`
  redirect.
- Astro Actions are not used.

## Write model

- **Self-contained requests.** A write carries everything the server needs. For
  a solve: puzzle, moves, name and Flash start. The server verifies on its own
  terms, for example by replaying the moves, and never depends on an earlier
  request.
- **One endpoint per write, whatever the source:** form POST, fetch or outbox
  replay.
- **Replay-safe.** Each write carries a client-made id. Unique indexes make a
  duplicate a no-op.
- **The client predicts, the server confirms.** `game/` runs on both sides, so
  the island shows the result at once. The response only updates the cookie and
  derived data.
- **Online-only is a short, named list:** hints, login and the editor solve.

## Offline

### Service worker

- Hand-written, ~150 lines. Not Workbox, not `@vite-pwa/astro`.
- **Manifest:** a build-time Vite plugin emits the hashed assets, every released
  puzzle URL and a build version, inlined into `sw.ts`.
- **Caches every released puzzle page** (~330 pages × ~6 KB gz ≈ 2 MB) in the
  background. Only when idle and on good connections, never on Save-Data. Calls
  `navigator.storage.persist()` once filled.
- **HTML: network first** with a ~300–500 ms timeout, then cache.
- **Assets: cache first.** Old versions stay while any cached page references
  them. Pages refresh lazily after a deploy: on visit, plus a slow background
  trickle.
- **`/offline`** lists the cached puzzles (`caches.keys()`) when a link isn't
  available.
- Never caches unreleased puzzles or other players' data.

### Outbox

- **A queue of requests, owned by the service worker,** stored in IndexedDB via
  `idb-keyval`.
- A failed POST to an allowlisted route (solve, feedback, profile name) is
  stored as method, URL, body and an id. The service worker answers with a
  pending response, or the usual 303 for a form POST.
- **Replay** runs in order on `online` and on the next navigation. Background
  Sync is a Chromium-only bonus.
- **Outcomes:** 2xx clears the entry, 4xx drops it, a network error or 5xx keeps
  it.
- Replays carry the current cookies. The browser stores the response's
  `Set-Cookie`, so the progress cookie updates on sync.
- Path claims go by server receipt. A late solve quietly misses the claim.
- **Pending solves** show as a plain fact ("saved on this device") until the
  server confirms them.

## Caching and prefetch

- **Edge cache for shared DO query results, not HTML.** The Worker's Cache API
  holds the top high score entries with names, and each puzzle's path groups,
  for 30–60 s with stale-while-revalidate.
- **Personalised pages render per player.** `/highscore` and the solutions pages
  add the viewer's own row or solutions: from cookies, plus one DO read for
  their own solutions.
- **Puzzle and archive pages are not edge-cached.** They render from bundled
  data and cookies with no store call.
- **Early Hints** for CSS and fonts.
- **Prefetch** of the likely next page: the next released puzzle, the archive,
  and the solutions page after a solve. Astro prefetch (hover, viewport) or
  Speculation Rules (open).
- Speed Brain doesn't prefetch Worker routes, so it isn't relied on.

## Solver

- Runs inside the Worker. `POST /api/solve` is public, and the search is bounded
  by a state budget.
- Budgets today: hints 7M states, editor 3M (~175 MB measured). The isolate cap
  is 128 MB.
- A spike picks one of four outcomes: it fits; compact TypeScript (packed
  integer states in typed arrays); Rust → WASM; or a lower budget.
- **If Rust:** only the BFS and its slide logic, compiled to WASM and imported
  by the Worker, holding packed states in a compact hash set. It must match
  `game/solver.ts` on all shipped puzzles. There is no separate Rust service;
  everything else stays TypeScript.

## Toolchain

- **Bun** for installs, scripts and `bun test`. Vitest is the fallback runner.
- **Vite 8**, **Oxlint + Oxfmt**, **TypeScript 7** (`tsc`).
- Skub's import rules (`#/` alias, import order) run as an Oxlint JS plugin.
- The new app is a Bun workspace with its own `package.json` and
  `cloudflare.config.ts`.
- `astro dev` runs under `bunx --bun`. If it misbehaves on Bun, the dev server
  runs on Node and Bun keeps everything else.

## Platform CLI, previews and e2e

- **`cf`** with `cloudflare.config.ts` and `@cloudflare/vite-plugin` v2 builds,
  runs dev in workerd and deploys. Wrangler is used only where `cf` lacks a
  feature (e.g. `wrangler preview`, if `cf` can't make per-branch previews).
- **Per-branch previews (Worker Previews):** one per branch, each with its own
  DO namespace and storage. KV, D1 and R2 are shared unless bound separately.
  Cron triggers and routes target production only.
- **E2E reset** is `deleteAll()` on the preview's DO, behind the e2e secret.
- **The e2e suite** runs on `@playwright/test` with the base URL as config.
  Until the switch, the same suite runs against both apps.

## Observability

- **Tracing:** `@opentelemetry/api` in code, exported over OTLP (HTTP/JSON) to
  an external backend (open). PostHog takes logs, not traces.
- **Product analytics:** server-side `posthog-node`, flushed with
  `ctx.waitUntil`. The `/ph` proxy stays.
- **Backup:** an hourly Cron Trigger writes a backup to GCS or R2 (open).

## Shared code

Until the Deno app is deleted, it and the new app import the same files:

- `game/`, the portable parts of `lib/`, and the Preact components and islands
  the new app can render.
- Shared code uses bare specifiers that resolve under both `deno.json` and
  `package.json`, plus the `#/` alias. JSR `@std/*` is swapped for npm.
- Shared code imports nothing from Fresh and uses no Deno APIs. Puzzles and
  names arrive through an injected source.
- The unit tests for shared code run under both `deno test` and `bun test`.

## Authoring tool

The puzzle authoring tool is a set of dev-only pages in the new app.

- **Scope:** candidates, scoring, the metric catalog, calibration scripts, the
  `/candidates` pages and the promote flow.
- **Pages:** Astro renders them, reusing the shared UI.
- **Writes:** a small dev-only Astro integration on the `astro:server:setup`
  hook provides the save and promote endpoints. It runs in the Vite dev process
  on the host, not in workerd, and writes `candidates/*.md` and
  `static/puzzles/*.md`.
- **Never in production:** the pages and the integration are excluded from
  production builds.
- **Contract with the player app:** the puzzle `.md` format and the shared
  `game/` code.
- **Lifetime:** retired when community submissions replace it.

Until it moves (after the switch), it runs locally on the Deno/Fresh app.

## Open

- Solver: compact TypeScript or Rust → WASM.
- SQL access: typed helpers or Drizzle's durable-sqlite driver.
- Backup target: GCS or R2.
- OTLP backend.
- Prefetch mechanism: Astro prefetch or Speculation Rules.
- The HTML network-first timeout, within ~300–500 ms.
- Per-branch previews through `cf` or `wrangler preview`.
- Not discussed yet: editor drafts and `oauth_state` expiry (KV `expireIn`
  today) in the schema, and `node:zlib` on workerd.
