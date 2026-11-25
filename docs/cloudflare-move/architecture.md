# North star architecture

The end state of Skub on Cloudflare, described as if it exists. PRs on the new
app are reviewed against this doc. Reasons and rejected options live in
[decisions.md](decisions.md); the order of work lives in
[rollout.md](rollout.md).

## At a glance

| Concern        | What we use                                                                                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime + host | Cloudflare Workers (workerd). One Worker serves everything.                                                                                                                                              |
| Store          | One SQLite-backed Durable Object (DO), `locationHint: "weur"`                                                                                                                                            |
| Framework      | Astro 6 + `@astrojs/preact` + `@astrojs/cloudflare`. Thin `.astro` page shells, TSX components and islands.                                                                                              |
| Client state   | Preact islands + signals. One island root per page that has shared state. Own `?dialog=` router. `ClientRouter`.                                                                                         |
| Puzzles        | Bundled at build time as a generated module                                                                                                                                                              |
| Static assets  | Workers Static Assets                                                                                                                                                                                    |
| Offline        | Hand-written service worker: caches Home and every released puzzle page; queues offline writes in IndexedDB (`idb-keyval`) and answers 202, so the player stays in place. Offline Home, no offline page. |
| Caching        | Edge cache for shared DO query results. Static pages prerendered. Early Hints. Prefetch.                                                                                                                 |
| Solver         | Runs only in the browser, in a Web Worker started by the page. TypeScript or Rust → WASM, decided by a spike.                                                                                            |
| Cron           | Cron Triggers: hourly backup; the import cron until the switch                                                                                                                                           |
| Observability  | OTLP export to an external backend. PostHog via `waitUntil`, `/ph` proxy.                                                                                                                                |
| Platform CLI   | `cf` with `cloudflare.config.ts` and `@cloudflare/vite-plugin` v2. Wrangler only where `cf` lacks a feature.                                                                                             |
| Toolchain      | Bun (installs, scripts, `bun test`), Vite 8, Oxlint + Oxfmt, TypeScript 7                                                                                                                                |
| Previews + e2e | One Worker Preview per branch, each with its own DO storage. `@playwright/test` against it.                                                                                                              |

## Invariants

Reviewers check these on every PR.

- **An anonymous GET makes no store call.** Pages render from the URL, signed
  cookies and bundled puzzles.
- **Every flow works without JS,** except the editor and hints.
- **Client/server alignment** (see [the section](#clientserver-alignment)):
  1. Every write answers with a 303. No JSON write endpoints.
  2. The URL is the only navigational state.
  3. Requests are self-contained. Cookies hold only identity and progress.
  4. One pure function in `game/` per derived view of the URL.
  5. JS changes presentation, not outcome.
  6. The open dialog is `getDialog(url, player)`.
  7. Redirect targets depend only on the request and static data.
- **Every write is replay-safe:** a client-made id plus a unique index.
- **Cookies are set by the server.** The outbox in IndexedDB is the one
  exception.
- **The HTML is always the server's.** The service worker caches pages; it never
  renders them.
- **Unreleased puzzles never ship publicly:** not as static files, not in the
  released puzzle list, not in the service worker precache.
- **Shared code is imported, never copied.**
- **Redirects are 303.**

## Runtime and host

- One Worker on Cloudflare Workers (workerd) serves pages, form POSTs, API
  endpoints, middleware and the cron.
- The DO is a class in the same codebase, exported from `src/worker.ts` next to
  the Astro adapter's `handle()`.
- There is no Node server and no separate serverless function.
- **The server is I/O-only.** It runs no search: a solve or submit is verified
  by replaying the moves, and stars come from the puzzle's static minimum moves.
- Workers limits: 128 MB memory per isolate, 30 s CPU by default (max 5 min),
  10k subrequests. Cron triggers on hourly or slower schedules get 15 min CPU.
- Environment comes from one env module. An explicit app-environment flag
  replaces today's `isDev` ("not on Deploy"). Secrets are Worker secrets.
- `COOKIE_SIGNING_KEY` is the same key the Deno app uses.
- Temporal: Bun has it natively; workerd gets a polyfill if it lacks it (pending
  the Astro spike).
- `node:zlib`, used for the progress cookie, runs under `nodejs_compat`. A
  runtime dependency to confirm in the Astro spike.

## Store

One SQLite-backed Durable Object is the whole database.

- **Placement:** `locationHint: "weur"`, set on first get. Objects never move.
  No replication.
- **Tables:** user, solution, score, user_score, feedback, rating and auth.
  - The user row holds the editor draft in a `draft` column.
  - A solution is one row. Today's four KV copies (by puzzle, by user, by user
    and puzzle, by canonical path) are indexes on that row.
  - Path groups are a SQL query over solutions.
  - The high score is a ranked SQL query over scores.
  - The auth tables keep the Auth0 `sub` → `userId` mapping, auth sessions, and
    `oauth_state` with an `expires_at` column that is checked on consume.
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
- **Skub's own `?dialog=` router** opens and closes explicit dialogs. Outcome
  dialogs are derived (see [alignment](#clientserver-alignment), 6).
- **`ClientRouter`** handles client navigation and view transitions. It replaces
  Fresh Partials. Its fetches go through the service worker.
- **Moves don't navigate.** They update the URL with `history.replaceState` plus
  a signal. A `ClientRouter` swap per move would remount the board island.
- **Static pages** (cookie policy and similar) are prerendered at build.
- **Puzzles are bundled at build time** as a generated module. No runtime disk
  reads. Names (`danish-names.json`) load the same way.
- **"Play next" is a concrete link.** The server renders the pseudo-random
  recommendation as `/puzzles/<slug>`, not a link to the `/puzzles/recommended`
  redirect.
- Astro Actions are not used.
- **Themes are colour-only variants of one look,** plus high-contrast for
  accessibility: skub, dracula, acid, catppuccin, solarized-light, ember and
  high-contrast. There are no retro themes; a player whose saved theme was a
  retro one falls back to skub, the existing fallback.

## Write model

- **Self-contained requests.** A write carries everything the server needs. For
  a solve: puzzle, moves, name, the Flash variant and a client-made id. The
  server verifies on its own terms, for example by replaying the moves, and
  never depends on an earlier request.
- **One endpoint per write, whatever the source:** a no-JS form POST, an
  island's `fetch` of the same `FormData` (through `submitForm()`) or an outbox
  replay. Each answers with a 303.
- **Replay-safe.** Each write carries a client-made id. Unique indexes make a
  duplicate a no-op.
- **The client predicts, the server confirms.** `game/` runs on both sides, so
  the island shows the result at once. The 303 lands on the same URL, and its
  `Set-Cookie` updates progress.
- **One action descriptor per write** in `game/actions/` (see
  [offline](#writes)).
- **Online-only is short:** login, and any write whose action isn't flagged
  `offline`. Hints and the editor solve run in the browser.

## Client/server alignment

The client and server never diverge on what a request means or where it lands.
Reviewers check all seven.

1. **Every write answers with a 303** to the page that shows its result. There
   are no JSON write endpoints. An island submits the same `FormData` with
   `fetch` and follows the redirect in place, through one shared `submitForm()`
   helper. Offline, the service worker answers 202 Queued instead, and
   `submitForm()` stays in place (see [offline](#writes)).
2. **The URL is the only navigational state:** moves, cursor, hint, Flash
   variant (`?flash=1`) and explicit dialogs. A signal may mirror the URL.
   Nothing the server reads may exist only in a signal, or in an httpOnly cookie
   the client has to shadow (e.g. the hint count is server-rendered into props,
   not mirrored in a signal).
3. **Requests are self-contained.** The variant, moves and client-made id are in
   the body or URL. The server never reads a cookie to decide what a request
   means. Cookies hold only identity and progress.
4. **One pure function per derived view of the URL,** in `game/`, shared by the
   server, the islands and the service worker: e.g.
   `derivePlayState(url, puzzle)` for moves, board and solved. Islands never
   re-derive these themselves.
5. **JS changes presentation, not outcome.** A JS path may show a pending state
   or animate, but it ends on the same URL and the same page as the no-JS path.
   A difference is a bug.
6. **The open dialog is a pure function of the URL and player state:**
   `getDialog(url, player)` in `game/`. An explicit `?dialog=` wins (one dialog
   at a time). Outcome dialogs (the name form, the first-stars explainer, the
   celebration) are derived from the solved board plus player state. The server
   evaluates it from cookies on every render, so a reloaded solved board shows
   the right dialog. Offline, the island evaluates it from the cached page's
   props plus the solve it just made.
7. **Redirect targets depend only on the request and static data,** e.g. an
   action's `redirect(input)` → the solved-board URL, in `game/actions/`.
   Anything that depends on player or store state is derived at render time,
   never baked into the redirect. The service worker doesn't compute redirects;
   this stays as good practice for the server.

Consequences:

- **Celebration stars** come from the progress cookie on the next render, not
  from redirect params.
- **Moves don't navigate** (see [framework](#framework-and-rendering)).

## Offline

Offline, the player stays where they are. Pages are always the server's HTML;
the service worker caches them and queues writes, and never renders, redirects
or sets cookies.

### Service worker

- Hand-written, ~150 lines. Not Workbox, not `@vite-pwa/astro`.
- **Build manifest:** a build-time Vite plugin emits the hashed assets and a
  build version, inlined into `sw.ts`. Assets only, no puzzles.
- **Released puzzle list:** a small server endpoint, e.g.
  `/puzzles/released.json`, lists the released puzzle URLs. It is cacheable
  until the next daily release and never lists unreleased slugs. The service
  worker fetches it on activate, and when online at most once a day, so a new
  daily puzzle is picked up without a deploy.
- **Precache:** `/` and the solver bundle on install. Then every released puzzle
  page (~330 pages × ~6 KB gz ≈ 2 MB) in the background: any page on the list it
  doesn't have yet. Only when idle and on good connections, never on Save-Data.
  Calls `navigator.storage.persist()` once filled.
- **Assets: cache first.** Old versions stay while any cached page references
  them. Pages refresh lazily after a deploy: on visit, plus a slow background
  trickle.
- Never caches unreleased puzzles or other players' data.
- **Bundles `game/`.** `game/` never imports server-only code (DB, env, cookie
  signing); the import lint enforces it.

### Navigation

- **Network first.** On failure, or after ~400 ms, serve the cached copy if
  there is one.
- **No cached copy, `ClientRouter` navigation:** if the request fails or is
  still pending after ~3 s, a global offline overlay dialog opens over the
  current page: "Waiting for connection…" plus a "Play offline" call to action.
  If the request completes, the navigation continues and the overlay closes, so
  the player may choose to wait.
- **No cached copy, full page load** (typed URL, reload, new tab): the service
  worker serves offline Home directly.

### Offline Home

There is no dedicated offline page. Offline Home is `/?offline&return=<url>`;
the service worker serves cached Home for it, matched ignoring the query. With
the flag, Home:

- dims links whose target isn't cached (checked via `caches.keys()`)
- shows a quiet "N solves will sync when you're back"
- when online again, opens a dialog offering to return to `return`; "back home"
  drops the flag

`return` lives in the URL. Opened online, `/?offline` renders normal Home and
still offers the return dialog.

### Writes

- **Action descriptors** in `game/actions/`: one per write, with `path`,
  `parse(form)`, `redirect(input)` (used by the server only) and an `offline`
  flag. Server routes use `parse` and `redirect`. The service worker derives its
  allowlist from `actions.filter((a) => a.offline)` and runs the cheap shared
  validity check (e.g. `isValidSolution`) before queueing.
- **Offline-capable writes always go through `submitForm()`,** not plain
  `ClientRouter` form submits.
- **A write gets a ~5 s timeout** before it's treated as offline, because
  tunnels hang rather than fail.
- **Offline, the service worker queues the request** (method, URL, body, id) in
  IndexedDB via `idb-keyval` and answers **202 Queued**. `submitForm()` stays on
  the page and switches to the outcome state in place.
- **Replays are idempotent** (client-made id plus unique index), so a lost
  response just replays harmlessly.
- **Replay triggers:** the page relays the `online` event to the service worker;
  any successful request drains the queue first; Background Sync is a
  Chromium-only bonus. Replays run in order.
- **Outcomes:** a 2xx or the write's 303 clears the entry, 4xx drops it, a
  network error or 5xx keeps it.
- **Cookies change only from the server's response on replay.** The service
  worker has no signing key, and browsers ignore `Set-Cookie` on synthetic
  responses.
- **After a sync,** the service worker messages open pages, so "saved on this
  device" quietly becomes "saved".
- **No cross-page pending overlay** for now. Other cached pages show stale
  progress until the next online render.
- Path claims go by server receipt. A late solve quietly misses the claim.

### Offline solution dialog

- Stars as placeholders (dashed outlines or question marks; the final look is
  decided in the build). None are computed offline.
- "Saved on this device".
- Calls to action: "Next puzzle" (cached) and "More puzzles" (→ offline Home).
  No "See solutions".
- A player without a name gets the name form. The name is queued with the solve,
  replayed in order, and the dialog shows their local (pending) name.

### Hints offline

Hints work offline: the solver runs in the page's Web Worker, and the hint spend
is an offline-capable write, queued like the others. Offline and on low-end
devices a lower state budget applies (see [solver](#solver)).

### Online-only

Login, and any write whose action isn't flagged `offline`.

## Caching and prefetch

- **Edge cache for shared DO query results, not HTML.** The Worker's Cache API
  holds the top high score entries with names, and each puzzle's path groups,
  for 30–60 s with stale-while-revalidate.
- **Personalised pages render per player.** `/highscore` and the solutions pages
  add the viewer's own row or solutions: from cookies, plus a direct DO read for
  their own solutions. The viewer's own solutions are never cached.
- **A solve invalidates its puzzle's path groups in its colo.** The Worker
  deletes that puzzle's cached entry (Cache API `delete`). The player's next
  request usually hits the same colo, so they see their path at once. Other
  players may lag by up to the TTL.
- **Puzzle and archive pages are not edge-cached.** They render from bundled
  data and cookies with no store call.
- **Early Hints** for CSS and fonts.
- **Prefetch** of the likely next page: the next released puzzle, the archive,
  and the solutions page after a solve. Astro prefetch (hover, viewport) or
  Speculation Rules (open).
- Speed Brain doesn't prefetch Worker routes, so it isn't relied on.

## Solver

- **Runs only in the browser,** in a Web Worker started by the page. No BFS on
  the server. Never in the service worker: a service worker can't start workers,
  and a long solve there would block every fetch.
- **Lazy-loaded** when a hint is requested or the editor opens. Precached by the
  service worker for offline use. It doesn't count against the 40 KB page
  budget.
- **Hints:**
  - The hint dialog always computes the hint in the Web Worker, online and
    offline, from the player's current position.
  - The hint POST only records the spend. The server sets the hint-count cookie.
    It's an offline-capable write, queued like the others (offline: 202, stay in
    place).
  - The allowance check uses the server-rendered hint count in props. It's
    trust-based, because the solver is public code anyway. On replay, a spend
    over the allowance is rejected and dropped quietly. The allowance is still
    one per puzzle.
  - Offline and on low-end devices, a lower state budget applies. Positions over
    it say "No hint available from here".
  - Without JS there are no hints: the hint control is hidden under `noscript:`
    or shows a quiet "Hints need JavaScript".
- **Editor:** solves in the same Web Worker. There is no `POST /api/solve` and
  no streamed solve; the editor talks to the worker by messages.
- **Stays TypeScript.** `game/solver.ts` already packs states into typed arrays
  with a number-based visited set. Phones are limited by speed, not memory, and
  WASM's likely 1.5–2× wouldn't change which positions get a hint. No Rust
  ([solver spike](spikes/solver-budget.md)).
- **Budgets:**

  | Use                     | States | Cost                                                                                    |
  | ----------------------- | ------ | --------------------------------------------------------------------------------------- |
  | Hint, phone and offline | 500k   | ~0.6–1 s, ~40 MB on a phone; covers ~93% of start and off-track positions, all mid-game |
  | Hint, desktop           | 3M     | ~1.5–2 s, ~165 MB; ~99%                                                                 |
  | Editor, desktop         | 3M     | ~1.5 s, ~160 MB                                                                         |
  | Editor, phone           | 1M     | ~70 MB                                                                                  |

  The page also stops the worker after ~1.5 s, so slow devices give up on time
  rather than state count. The old 7M hint budget is dropped.
- **State key works for any piece count.** Today's key is exact only up to 8
  pieces: Ulf (28 pieces) never finishes and Nis (15) uses approximate keys.
  Fixed in step 1, before the solver moves.

## Toolchain

- **Bun** for installs, scripts and `bun test`. Vitest is the fallback runner.
- **Vite 8**, **Oxlint + Oxfmt**, **TypeScript 7** (`tsc`).
- Skub's import rules (`#/` alias, import order, the `game/` boundary) run as a
  pinned Oxlint JS plugin.
- The repo-root `package.json` is the Bun workspace root; the new app is a
  member with its own `package.json` and `cloudflare.config.ts`. `bun.lock` is
  committed, and deps shared with `deno.json` are pinned to the same version.
- Shared tests use `node:test`, so they run under `deno test` and `bun test`.
- One formatter per file until cleanup: `deno fmt` for the Deno app and shared
  code, Oxfmt for the new app (proposed, pending owner).
- Playwright and Oxlint always run as `bunx --bun`.
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
  `package.json`, plus the `#/` alias. `@std/*` resolves from the JSR npm mirror
  under Bun.
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

It is ported before the switch, in rollout step 4. Until then it runs locally on
the Deno/Fresh app.

## Parked

- **View transitions.** `ClientRouter` brings them; the design is decided later.
  Ideas already in TODO.md: zoom into the board page, and the puzzle card's
  thumbnail morphing into the board. Moves never navigate, so there are no
  transitions per move. Nothing in the port should block them: keep stable
  element identities for the board and thumbnails.

## Open

- Solver: compact TypeScript or Rust → WASM.
- SQL access: typed helpers or Drizzle's durable-sqlite driver.
- Backup target: GCS or R2.
- OTLP backend.
- Prefetch mechanism: Astro prefetch or Speculation Rules.
- Per-branch previews through `cf` or `wrangler preview`.
