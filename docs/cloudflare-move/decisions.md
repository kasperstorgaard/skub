# Decisions

One entry per decision from the 2026-11-24 planning session
([raw notes](2026-11-24-meeting-notes.md)), in the order they were made. The end
state is described in [architecture.md](architecture.md).

## 1. Host and runtime: Cloudflare Workers

- **Date:** 2026-11-24
- **Decision:** Cloudflare Workers (workerd) is the runtime and host.
- **Alternatives:** none recorded.
- **Why:** Deno joined Cloudflare and Deno Deploy shuts down around April 2027.
  Cloudflare's path is Workers plus Durable Objects, and workerd with Deno's
  celld makes single-object DOs self-hostable, so the self-hosting path stays
  open.

## 2. Store: one SQLite Durable Object

- **Date:** 2026-11-24
- **Decision:** one SQLite-backed Durable Object (DO) holds everything. A solve
  is one `transactionSync`: insert the solution once (unique index dedup), claim
  the path, award the score.
- **Alternatives:**
  - D1: kept as the fallback.
  - Workers KV: rejected. No atomics, eventually consistent.
- **Why:** SQLite runs in the same process as the object. The four solution
  copies collapse to one row plus indexes, paths and the high score become SQL,
  and versionstamps and retry loops go away.

## 3. Parallel rebuild, not a bridge

- **Date:** 2026-11-24
- **Decision:** build the new app in parallel in the same repo, in its own Bun
  workspace. Shared pure code is imported, not copied. Two CI pipelines. No
  bridge.
- **Alternatives:** the first plan layered the move on `main` with Fresh as a
  bridge. Replaced.
- **Why:** Kasper: "Could just start the transition in parallel and swap when I
  am satisfied with the move (double CI until then)."

## 4. Toolchain: Bun

- **Date:** 2026-11-24
- **Decision:** Bun for installs, scripts and `bun test`. Vite 8, Oxlint +
  Oxfmt, TypeScript 7.
- **Alternatives:**
  - Vitest: the fallback test runner.
  - Vite+: dropped. It manages Node, which competes with Bun.
- **Why:** Kasper: "I would like to try bun if at all feasible." Deno's
  toolchain ends with the runtime. VoidZero (Vite, Vitest, Oxc) is now
  Cloudflare-owned.

## 5. Framework: Astro 6 + Preact islands

- **Date:** 2026-11-24
- **Decision:** Astro 6 with `@astrojs/preact` and `@astrojs/cloudflare`. Pages
  are thin `.astro` shells; components and islands stay TSX. Shared signals move
  to one island root per page. Skub's own `?dialog=` router stays.
  `ClientRouter` replaces Partials. The DO is exported from `src/worker.ts` next
  to the adapter's `handle()`.
- **Alternatives:**
  - Fresh on workerd: unmaintained.
  - A Fresh fork: dead upstream.
  - Remix 3: shipped October 2026, but no `@preact/signals`, Node-only tooling,
    a beta Workers path.
  - HonoX: alpha.
  - React-based (React Router 7, TanStack Start, RedwoodSDK, vinext): over the
    JS budget.
  - SvelteKit: the most native service worker, but its adapter can't export a
    DO, dev runs through `getPlatformProxy`, and it hydrates whole routes.
  - Qwik: dropped its service worker; 2.0 still RC.
  - Mastro: 0.1.x, renders in the service worker.
  - SolidStart: not researched.
  - Solid islands inside Astro: raised; Kasper chose Preact.
  - Fallback: our own thin layer (Hono + Vite + Preact, ~800 lines).
- **Why:** Cloudflare owns Astro (2026-01-16). It runs workerd in dev, prerender
  and production, keeps Preact islands, and has a Bun recipe.

## 6. Platform CLI: `cf`

- **Date:** 2026-11-24
- **Decision:** `cf` with the Vite plugin v2, for now.
- **Alternatives:** Wrangler, used only where `cf` lacks something (e.g.
  per-branch previews, if `cf` can't yet).
- **Why:** `cf` is Wrangler's successor, built on Vite and generated from the
  full API. Wrangler gets 18 months after the `cf` beta ends. Starting on `cf`
  avoids a second tooling move.

## 7. Rust only for the solver, if its spike wins

- **Date:** 2026-11-24
- **Decision:** Rust → WASM inside the Worker for the solver only, and only if
  the spike shows it's needed. Packed states in a compact hash set, checked
  against `game/solver.ts` on every puzzle file (all 340, unreleased included;
  it's offline dev tooling).
- **Alternatives:**
  - Compact TypeScript, or a lower budget: the other spike outcomes.
  - A separate Rust API for the server: rejected.
- **Why:** the BFS is the one CPU- and memory-bound piece and the one that
  pushes against 128 MB. The rest of the server is I/O-bound and shares types
  and rules with the islands.

## 8. One Worker, no serverless functions, no Node server

- **Date:** 2026-11-24
- **Decision:** one Worker serves pages, form POSTs, API endpoints, middleware
  and the cron. The DO is a class in the same codebase.
- **Alternatives:** Astro Actions: skipped, as they are JS-first.
- **Why:** not recorded beyond the principles: server first, simple at a glance.

## 9. Offline-first is in scope

- **Date:** 2026-11-24
- **Decision:** offline support is part of the rebuild. Pages stay
  server-rendered; the service worker only caches.
- **Alternatives:**
  - Server rendering in the service worker: rejected. Safari lacks the service
    worker `cookieStore`, the signing key can't ship, no framework support.
  - Local SQLite (WASM + OPFS) as a client DB: possible, rejected for now. Tiny
    per-player data, shared data can't go offline, heavy, a second source of
    truth.
  - Sync engines (Zero, LiveStore): client-first, break no-JS.
- **Why:** Kasper: "I like the idea of incorporating offline first in this
  revamp"; it "might force some good architecture decisions". It doesn't tip the
  framework choice, and slightly favours SQLite on the server.

## 10. Write model

- **Date:** 2026-11-24
- **Decision:** self-contained requests (the server verifies by replaying
  moves); one endpoint per write for form POST, fetch and replay; replay-safe
  via a client-made id and unique indexes; the client predicts, the server
  confirms; online-only is a short named list (hints, login, editor solve).
- **Alternatives:** none recorded.
- **Why:** forced by offline. Writes only add facts, so they can be eventually
  consistent with no conflict handling.

## 11. Outbox: a queue of requests in IndexedDB

- **Date:** 2026-11-24
- **Decision:** the service worker owns a queue of requests, stored in IndexedDB
  via `idb-keyval`. Replays in order on `online` and on the next navigation;
  Background Sync is a Chromium bonus. 2xx clears, 4xx drops, network error or
  5xx keeps. Path claims go by server receipt.
- **Alternatives:** the Cache API used as a key-value store: rejected as "too
  custom".
- **Why:** Kasper: "it should be a queue of requests, for simplicity", and a
  "tiny idb instead". It's the one exception to "server-set cookies only".

## 12. Offline scope: cache everything released

- **Date:** 2026-11-24
- **Decision:** cache every released puzzle page (~330 × ~6 KB gz ≈ 2 MB) with a
  hand-written service worker (~150 lines) and a build-time manifest (assets
  only since entry 21). HTML network-first with a ~300–500 ms timeout; assets
  cache-first, old versions kept while cached pages reference them. Idle and
  good connections only, never Save-Data. `/offline` lists cached puzzles.
- **Alternatives:**
  - Intermittent offline only: discussed first. Longer offline needs cross-page
    progress, offline recommendations and daily rollover; caching everything
    solves the recommendation part.
  - Workbox, `@vite-pwa/astro`: not used.
  - Client-side rendering of puzzles from cached data: rejected as "too custom".
    `ClientRouter` fetches the server's HTML through the service worker instead.
- **Why:** the numbers came in small: the whole released set is about 2 MB.

## 13. "Play next" is a concrete link

- **Date:** 2026-11-24
- **Decision:** the server renders the pseudo-random recommendation as a link to
  `/puzzles/<slug>`, not to the `/puzzles/recommended` redirect.
- **Alternatives:** keep the redirect.
- **Why:** works without JS, saves a round trip, and lands on a cached page
  offline.

## 14. Caching

- **Date:** 2026-11-24
- **Decision:** edge-cache shared DO query results (top high score entries with
  names, path groups) for 30–60 s with stale-while-revalidate. Prerender static
  pages. Early Hints for CSS and fonts. Astro prefetch or Speculation Rules for
  the likely next page.
- **Alternatives:**
  - Edge-caching HTML: rejected. `/highscore` and the solutions pages are
    personalised.
  - Edge-caching puzzle pages: not now. They're "90% cacheable", but the
    uncached path has no store call, so a hit only saves render CPU. Revisit
    with HTMLRewriter if render takes more than ~20 ms.
  - Server islands: rejected. They need JS.
- **Why:** keep the store off the critical path without caching anything
  personal.

## 15. DO placement: western Europe, no replication

- **Date:** 2026-11-24
- **Decision:** one DO with `locationHint: "weur"`, no replication.
- **Alternatives:**
  - D1 read replicas with session bookmarks: not justified.
  - `jurisdiction("eu")`: available (hard, permanent); not chosen.
- **Why:** Kasper wanted the DB closest to the user "if not too complex to
  replicate". The design already keeps the DB off the critical path: pages
  render from cookies at the edge, shared reads are edge-cached, solves are
  optimistic. Revisit if non-EU traffic grows.

## 16. SQL tests: a few scenarios

- **Date:** 2026-11-24
- **Decision:** store code takes a minimal `exec(sql, ...params)` interface. A
  handful of scenario tests run on in-memory `bun:sqlite`.
- **Alternatives:** testing each query or the SQL library: rejected.
- **Why:** Kasper: "some, but don't start testing SQL lib, more like
  integration".

## 17. No feature freeze

- **Date:** 2026-11-24
- **Decision:** the Deno app keeps shipping. Two rules instead: a change to
  stored data on the Deno app maps itself into the import and schema in the same
  PR; UI changes land in shared code or get ported with their flow.
- **Alternatives:** a freeze during the move.
- **Why:** Kasper: "don't see the need really".

## 18. Transition: `next.skub.app` and a one-way import

- **Date:** 2026-11-24
- **Decision:**
  - The new Worker serves `next.skub.app`.
  - A one-way, idempotent import cron from the hourly GCS backup (bots dropped,
    `INSERT OR IGNORE`, scores rebuilt). Logging in on `next` shows the real
    account. Writes on `next` stay there.
  - The switch, when bug-free: read-only window → final import → verify counts →
    DNS. Rollback is DNS back and loses only post-switch writes.
  - The same `COOKIE_SIGNING_KEY`, so signed cookies survive. Auth sessions were
    expected to drop (one re-login); entry 23 imports them instead.
  - The ~1M bot `user` records don't move.
- **Alternatives:** a routing Worker on `skub.app` with a feature flag:
  rejected. It adds a hop and a moving part in front of production.
- **Why:** Kasper: "parallel builds, a data transfer/backup one way and a
  feature flag/separate url. Then I can switch when the bugs are eradicated."

## 19. The authoring tool is ported before the switch, as dev-only pages

- **Date:** 2026-11-24
- **Decision:** the puzzle authoring tool (candidates, scoring, the metric
  catalog, calibration scripts, the `/candidates` routes and the promote flow)
  moves into the new app before the switch, like every other flow.
  - Dev-only pages rendered by Astro with the shared UI.
  - A dev-only Astro integration (`astro:server:setup`, in the Vite dev process
    on the host, not in workerd) provides the save and promote endpoints that
    write `candidates/*.md` and `static/puzzles/*.md`.
  - Excluded from production builds.
  - After the switch, the Deno app is deleted entirely.
  - Its contract with the player app is the puzzle `.md` format and the shared
    `game/` code. It retires when community submissions replace it.
- **Alternatives:** both replaced the same day:
  - Keeping it on Deno for good, trimming the Deno app down to it.
  - Moving it after the switch, with the Deno app kept locally until then.
- **Why:** Kasper: "Everything gets ported before cutover, even local flows." He
  needs the tool until community submissions come in, and it stays in the repo
  to reuse the shared UI. Which framework drives it doesn't matter.

## 20. CSS budget: what CI enforces today

- **Date:** 2026-11-24
- **Decision:** the entry CSS stays ≤ 16 KB gz and each theme ≤ 6 KB gz, as
  `scripts/check-css.ts` enforces.
- **Alternatives:** 14 KB gz (from the notes) and 15 KB gz (TODO.md, the
  frontend skill).
- **Why:** the notes, TODO.md, the skill and CI disagreed. CI is the one that's
  enforced.

## 21. Released puzzles come from an endpoint, not the build

- **Date:** 2026-11-24
- **Decision:** the service worker's build manifest holds assets only. The
  released puzzle list comes from a small server endpoint, e.g.
  `/puzzles/released.json`, cacheable until the next release and never listing
  unreleased slugs. The service worker fetches it on activate and, when online,
  at most once a day, then caches any pages it doesn't have yet.
- **Alternatives:** released puzzle URLs in the build manifest: rejected.
- **Why:** a puzzle releases every day without a deploy, so a build-time list
  lags until the next deploy.

## 22. A solve invalidates its path groups in its colo

- **Date:** 2026-11-24
- **Decision:** the viewer's own solutions are always a direct DO read, never
  cached. On a solve, the Worker deletes that puzzle's cached path-group entry
  in its colo (Cache API `delete`).
- **Alternatives:** live with the 30–60 s TTL for everyone.
- **Why:** read-after-write matters on solve → solutions page. The player's next
  request usually hits the same colo, so they see their path at once. Other
  players may lag by up to the TTL, which is fine.

## 23. Schema gaps closed, auth sessions imported

- **Date:** 2026-11-24
- **Decision:**
  - Editor drafts become a `draft` column on `user`.
  - `oauth_state` gets an `expires_at` column, checked on consume (replacing
    KV's `expireIn`).
  - `auth_session` is imported, so nobody has to log in again at the switch.
  - `node:zlib`, used for the progress cookie, runs under `nodejs_compat`, to be
    confirmed in the Astro spike.
- **Alternatives:** dropping sessions at the switch (one re-login).
- **Why:** these were the stored data and runtime couplings the first plan
  didn't place.

## 24. E2E first for uncovered flows

- **Date:** 2026-11-24
- **Decision:** a flow with no e2e today gets lean e2e written against the Deno
  app before it's ported: core outcome only, seeded state, existing conventions.
  The test passes on the Deno app, then on the flow's preview. Login seeds a
  session rather than driving Auth0.
- **Alternatives:** write the tests only on the new app.
- **Why:** the e2e suite is the parity check. A test that never ran on the Deno
  app can't show the port matches it.

## 25. Retro themes are cut

- **Date:** 2026-11-24
- **Decision:** the new app ports skub, the other original colour themes
  (dracula, acid, catppuccin, solarized-light, ember) and high-contrast. The
  retro themes (matrix, discman, geocities, sash, riso, digicam, dookie, and the
  retired moquette) are cut, not deferred. Players with a retro theme fall back
  to skub, the existing fallback. The Deno app keeps them until the switch, with
  no freeze.
- **Alternatives:** porting them, or deferring them.
- **Why:** Kasper: "Little chance they get maintained really, is the main risk."

## 26. Streak and skill stay

- **Date:** 2026-11-24
- **Decision:** the streak is ported as is. The skill level is ported too, as
  the engine to build onboarding on.
- **Alternatives:** cutting either in the "kill your darlings" review.
- **Why:** Kasper: "Streak 100% stays, and skill is a good engine to tie into
  and evolve for onboarding."

## 27. Client/server alignment invariants

- **Date:** 2026-11-24
- **Decision:** seven invariants keep the client and server on one path (see
  [architecture.md](architecture.md#clientserver-alignment)): every write
  answers with a 303; the URL is the only navigational state; requests are
  self-contained; one pure function in `game/` per derived view of the URL; JS
  changes presentation, not outcome; the open dialog is
  `getDialog(url, player)`; redirect targets depend only on the request and
  static data.
- **Alternatives:** today's shape, where some flows take a JSON branch with JS
  and a 303 branch without, and the client shadows server state in signals.
- **Why:** Kasper: "some flows diverge on client/server… Wins on simplicity for
  sure". One path also means the service worker can answer an offline write with
  the same redirect as the server.

## 28. The Flash variant lives in the URL

- **Date:** 2026-11-24
- **Decision:** the Flash variant is `?flash=1` in the URL and is sent with the
  solve. The server never reads the Flash cookie to decide what a solve means.
- **Alternatives:** today's Flash cookie as the source of the variant.
- **Why:** follows from invariants 2 and 3. It fixes the TODO "A solve saves as
  the variant it was played": a back/forward cache restore or a second tab can
  no longer pair one variant's board with the other's cookie.

## 29. Outcome dialogs are derived at render

- **Date:** 2026-11-24
- **Decision:** outcome dialogs (the name form, the first-stars explainer, the
  celebration) are derived by `getDialog(url, player)` on every render, not
  encoded in the redirect. An explicit `?dialog=` still wins.
- **Alternatives:** today's redirect of any solved board to `?dialog=solution`.
- **Why:** follows from invariants 6 and 7. It fixes the TODO "Reloading a
  solved board shows the celebration": a named player who reloads gets the
  celebration, not the name form.

## 30. JSON write branches are deleted

- **Date:** 2026-11-24
- **Decision:** every write endpoint loses its JSON branch: hint, Flash,
  feedback, solve and the tutorial's auto-post. Islands submit the same
  `FormData` through `submitForm()` and follow the 303 in place.
- **Alternatives:** keeping two representations per write.
- **Why:** follows from invariants 1 and 5. One path to test, and no-JS and JS
  land on the same page by construction.
