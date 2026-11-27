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
- **Superseded in part by [entry 50](#50-temporary-monorepo-no-shared-code):**
  the new app copies what it needs; no code is shared.

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

## 5. Framework: Astro 7 + Preact islands

- **Date:** 2026-11-24
- **Decision:** Astro 7 (see 44) with `@astrojs/preact` and
  `@astrojs/cloudflare`. Pages are thin `.astro` shells; components and islands
  stay TSX. Shared signals move to one island root per page. Skub's own
  `?dialog=` router stays. `ClientRouter` replaces Partials. The DO is exported
  from `src/worker.ts` next to the adapter's `handle()`.
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
- **Alternatives:** Wrangler. Fully replaced (see 45).
- **Why:** `cf` is Wrangler's successor, built on Vite and generated from the
  full API. Wrangler gets 18 months after the `cf` beta ends. Starting on `cf`
  avoids a second tooling move.

## 7. Rust only for the solver, if its spike wins

- **Date:** 2026-11-24
- **Decision:** Rust → WASM inside the Worker for the solver only, and only if
  the spike shows it's needed. Packed states in a compact hash set, checked
  against `game/solver.ts` on a handful of puzzles (the most blockers, the
  highest `minMoves`, a few typical). A full-corpus run was judged overkill
  (Kasper, 2026-11-25).
- **Alternatives:**
  - Compact TypeScript, or a lower budget: the other spike outcomes.
  - A separate Rust API for the server: rejected.
- **Why:** the BFS is the one CPU- and memory-bound piece and the one that
  pushes against 128 MB. The rest of the server is I/O-bound and shares types
  and rules with the islands.
- **Revised by entry 37:** the solver moved to the browser. The Rust question is
  now about speed and memory on phones, not Workers limits.

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
  confirms; online-only is a short named list (hints, login, editor solve; hints
  and the editor solve left it in entry 37).
- **Alternatives:** none recorded.
- **Why:** forced by offline. Writes only add facts, so they can be eventually
  consistent with no conflict handling.

## 11. Outbox: a queue of requests in IndexedDB

- **Date:** 2026-11-24
- **Decision:** the service worker owns a queue of requests, stored in IndexedDB
  via `idb-keyval`. Replays in order on `online` and on the next navigation
  (triggers revised by entry 32); Background Sync is a Chromium bonus. 2xx
  clears, 4xx drops, network error or 5xx keeps. Path claims go by server
  receipt.
- **Alternatives:** the Cache API used as a key-value store: rejected as "too
  custom".
- **Why:** Kasper: "it should be a queue of requests, for simplicity", and a
  "tiny idb instead". It's the one exception to "server-set cookies only".

## 12. Offline scope: cache everything released

- **Date:** 2026-11-24
- **Decision:** cache every released puzzle page (~330 × ~6 KB gz ≈ 2 MB) with a
  hand-written service worker (~150 lines) and a build-time manifest (assets
  only since entry 21). HTML network-first with a ~300–500 ms timeout (~400 ms
  since entry 35); assets cache-first, old versions kept while cached pages
  reference them. Idle and good connections only, never Save-Data. An `/offline`
  page listed cached puzzles: replaced by offline Home (entry 34).
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
    uncached path has no store call, so a hit only saves render CPU. Settled by
    the Astro spike: warm SSR is 2–4 ms, no HTMLRewriter (see 48).
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
  PR; UI changes land on the Deno app and get ported with their flow or after
  it.
- **Alternatives:** a freeze during the move.
- **Why:** Kasper: "don't see the need really".
- **Extended by [entry 50](#50-temporary-monorepo-no-shared-code):** a change to
  `game/` logic on the Deno app lands in both copies in the same PR, or gets a
  line in [parity.md](parity.md#game-changes-waiting-for-a-copy).

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
  - Dev-only pages rendered by Astro with the new app's UI.
  - A dev-only Astro integration (`astro:server:setup`, in the Vite dev process
    on the host, not in workerd) provides the save and promote endpoints that
    write `candidates/*.md` and `static/puzzles/*.md` (in `deno/` until
    cleanup).
  - Excluded from production builds.
  - After the switch, the Deno app is deleted entirely.
  - Its contract with the player app is the puzzle `.md` format and the new
    app's `game/` code. It retires when community submissions replace it.
- **Alternatives:** both replaced the same day:
  - Keeping it on Deno for good, trimming the Deno app down to it.
  - Moving it after the switch, with the Deno app kept locally until then.
- **Why:** Kasper: "Everything gets ported before cutover, even local flows." He
  needs the tool until community submissions come in, and it stays in the repo
  to reuse the player app's UI. Which framework drives it doesn't matter.

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
  sure". The first version had the service worker answer an offline write with
  the server's redirect (`getSolveRedirect`); replaced by entry 32. Invariant 7
  stays as good practice for the server.

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

## 31. No further cuts for now

- **Date:** 2026-11-24
- **Decision:** beyond the retro themes, everything ports with its current
  outcome. The proposed simplifications are paused: cut Panel/ActionsPanel,
  collapse feedback and rating, a plain archive list instead of the calendar and
  scroller, and dropping the redirect routes and the print panel.
- **Alternatives:** trimming them in the port.
- **Why:** Kasper: "Let's not cut more right now. Simplifications paused." The
  alignment invariants and the "next" link still apply where they already change
  mechanism.

## 32. Offline writes answer 202 and stay in place

- **Date:** 2026-11-25
- **Decision:**
  - Each write is an action descriptor in `game/actions/` (`path`,
    `parse(form)`, `redirect(input)` for the server, `offline` flag). The
    service worker's allowlist is the actions flagged `offline`, and it runs the
    shared validity check before queueing.
  - A write gets a ~5 s timeout before it counts as offline. Offline, the
    service worker queues it in IndexedDB and answers 202 Queued. `submitForm()`
    stays on the page and shows the outcome in place.
  - Replays are idempotent. Triggers: the page relays `online`, any successful
    request drains the queue first, Background Sync on Chromium. After a sync,
    open pages hear about it and "saved on this device" becomes "saved".
- **Alternatives:** the service worker answering with
  `Response.redirect(getSolveRedirect(...), 303)` to a cached page (entry 27's
  first version): replaced.
- **Why:** tunnels hang rather than fail, so a timeout is needed. Staying in
  place needs no synthetic redirect and no cached target page.

## 33. No cross-page pending overlay, for now

- **Date:** 2026-11-25
- **Decision:** the service worker can't set cookies (no signing key, and
  browsers ignore `Set-Cookie` on synthetic responses), so cookies only change
  from the server's response on replay. Other cached pages show stale progress
  until the next online render.
- **Alternatives:** a client-side overlay of pending solves on every page.
- **Why:** it can be added later if it's missed.

## 34. Offline Home instead of an offline page

- **Date:** 2026-11-25
- **Decision:** `/` is precached on install. Offline Home is
  `/?offline&return=<url>`, served from the cached Home. It dims links to
  uncached pages, shows "N solves will sync when you're back", and offers to
  return to `return` once online. The offline solution dialog shows placeholder
  stars, "saved on this device", "Next puzzle" and "More puzzles" (no "See
  solutions"). Hints said "Hints need a connection" (replaced by entry 37: hints
  work offline).
- **Alternatives:** a dedicated `/offline` page listing cached puzzles:
  replaced.
- **Why:** Kasper: "an offline version of Home instead of dedicated offline
  page". `return` lives in the URL, as all navigational state does.

## 35. The offline overlay opens on timeout or failure

- **Date:** 2026-11-25
- **Decision:** navigation is network first; on failure or after ~400 ms the
  cached copy is served. With no cached copy, a `ClientRouter` navigation that
  fails or is still pending after ~3 s opens a global overlay ("Waiting for
  connection…" plus "Play offline"). If the request completes, the navigation
  continues and the overlay closes. A full page load with no cached copy gets
  offline Home.
- **Alternatives:** an overlay keyed to a list of routes that can't work offline
  (high score, solutions, profile).
- **Why:** Kasper: "Might be on offline after a timeout or a failed navigation."
  Keyed to what actually happens, not a route list, so cached pages just work
  and the player may choose to wait.

## 36. The name is queued with the solve

- **Date:** 2026-11-25
- **Decision:** a player without a name gets the name form offline too. The name
  is queued with the solve, replayed in order, and the dialog shows their local
  (pending) name.
- **Alternatives:** skip naming offline and ask once back online.
- **Why:** Kasper: "Queue, your local name." It's one more queued write and the
  player sees no difference.

## 37. The solver moves to the browser; hints need JS

- **Date:** 2026-11-25
- **Decision:**
  - No BFS on the server. The solver runs only in a Web Worker started by the
    page, never in the service worker (it can't start workers, and a long solve
    would block every fetch).
  - The hint dialog computes the hint in the Web Worker, online and offline. The
    hint POST only records the spend; it's offline-capable and queued. The
    allowance (one per puzzle) is checked from the server-rendered count and is
    trust-based; an over-allowance spend is dropped on replay. A lower budget
    applies offline and on low-end devices ("No hint available from here").
  - Without JS there are no hints.
  - The editor solves in the same Web Worker. `POST /api/solve` and the streamed
    solve are removed.
  - Submit and solve stay cheap on the server: replay the moves, stars from the
    static minimum moves.
  - The solver is lazy-loaded, precached for offline, and outside the 40 KB page
    budget.
- **Alternatives:** a small server solver kept only for no-JS hints: rejected.
- **Why:** Kasper: "Let's actually go option 2: hints need js". The server
  becomes I/O-only, the Workers memory risk goes, and hints work offline. The
  solver is public code, so a trust-based allowance gives nothing away.

## 38. Shared tests use `node:test`

- **Date:** 2026-11-25
- **Decision:** shared tests import `test` from `node:test`, so one file runs
  under both `deno test` and `bun test` during the transition. `@std/assert`
  stays, from npm (`@jsr/std__assert`). The port is scripted.
- **Alternatives:** `bun:test` (fails under Deno, "Unsupported scheme bun"), or
  `bun:test` mapped to a 3-line shim in `deno.json`: works, but needs a shim and
  an import map entry.
- **Why:** the [Bun toolchain spike](spikes/bun-toolchain.md): `node:test` needs
  no shim, no import map entry and no new file. The sample ran 147/147 on both
  runtimes.
- **Superseded by [entry 50](#50-temporary-monorepo-no-shared-code):** no test
  runs under both runners. The new app's tests use `bun:test`; `@std/assert`
  stays from npm, so the port is still a scripted import swap.

## 39. The repo root is the Bun workspace root

- **Date:** 2026-11-25
- **Decision:** the repo-root `package.json` is the Bun workspace root, with the
  new app as a member. Deps used by both sides are pinned to the same version in
  `deno.json` and `package.json`. `bun.lock` is committed.
- **Alternatives:** an app-local `package.json` only: it can't resolve `@std/*`
  for root-level `game/`.
- **Why:** Bun resolves bare specifiers by walking up from the importing file,
  so `game/` needs a root `node_modules`. In the spike, an unpinned
  `@playwright/test` moved Deno's Playwright from 1.59.1 to 1.65.1, which needs
  a different Chromium.
- **Superseded by [entry 50](#50-temporary-monorepo-no-shared-code):** there is
  no root `package.json`. `web/` has its own `package.json` and `bun.lock`, and
  no dep is pinned in both apps.

## 40. Server-only code leaves `game/` in step 1

- **Date:** 2026-11-25
- **Decision:** in step 1, `game/cookies.ts`, `game/profile-cookie.ts` and
  `game/progress-cookie.ts` move out of `game/` or take env and signing as
  parameters; `loader.ts` and `solver-queue.ts` get `isDev` injected; `names.ts`
  uses a JSON import. Then the `game/` boundary rule is turned on.
- **Alternatives:** none recorded.
- **Why:** the boundary rule flags 7 violations today (env and cookie signing
  imported into `game/`), and `game/` must bundle into the service worker.
- **Revised by [entry 50](#50-temporary-monorepo-no-shared-code):** this applies
  to the new app's copy of `game/` only. The Deno app's `game/` stays as it is.

## 41. One formatter per file until cleanup (proposed)

- **Date:** 2026-11-25
- **Status:** proposed by the lead, never confirmed. Superseded by
  [entry 50](#50-temporary-monorepo-no-shared-code): no file is shared, so each
  app keeps its own formatter.
- **Decision:** `deno fmt` owns the Deno app and shared code until cleanup.
  Oxfmt owns only the new app's directory. Shared code is reformatted once by
  Oxfmt at cleanup.
- **Alternatives:** reformat shared code with Oxfmt now (54 files) and swap
  `deno fmt --check` for Oxfmt in the Deno CI.
- **Why:** the two formatters can't both pass on one file: after Oxfmt,
  `deno fmt --check` still fails 24 files.

## 42. The solver stays TypeScript, with device-sized budgets

- **Date:** 2026-11-25
- **Decision:** no Rust. Hint budgets are 500k states on phones and offline, 3M
  on desktop; the editor keeps 3M on desktop and gets 1M on phones; the page
  stops the worker after ~1.5 s. The 7M hint budget is dropped.
- **Alternatives:** compact TypeScript (a tighter visited set: 15–25% less
  memory but 1.3–1.6× slower), Rust → WASM.
- **Why:** the solver spike. `game/solver.ts` is already compact; phones are
  limited by speed, not memory, and neither alternative changes which positions
  get a hint. Phone figures are estimates until Kasper measures on a real phone.

## 43. The solver's state key handles any piece count

- **Date:** 2026-11-25
- **Decision:** fix the state key in step 1 so it's exact for any number of
  pieces.
- **Why:** it's exact only up to 8 pieces. On Ulf (28 pieces) nearly every key
  collides and a hint never finishes; on Nis (15) two positions can be taken as
  one. Found by the solver spike; it affects today's server too.
- **Revised by [entry 50](#50-temporary-monorepo-no-shared-code):** step 1 fixes
  the new app's copy only. The live Deno app needs its own `fix/` branch.

## 44. Astro 7.4+ with `@astrojs/cloudflare` 15

- **Date:** 2026-11-25
- **Decision:** Astro 7.4+ with `@astrojs/cloudflare` 15 (beta), not Astro 6.
- **Why:** the Astro spike. `cf` and Vite plugin v2 need adapter 15, which needs
  Astro ≥ 7.4. Astro 6's adapter (v13) only supports Wrangler and plugin v1.

## 45. No Wrangler

- **Date:** 2026-11-25
- **Decision:** `cf` and Vite plugin v2 do everything. `cloudflare.config.ts`
  holds the custom entrypoint, the SQLite DO, `nodejs_compat` and secrets. The
  auto-added `SESSION` and `IMAGES` bindings are turned off.
- **Why:** the Astro spike. Adapter 15 doesn't read `wrangler.*` at all.

## 46. Astro runs on Node; Bun does the rest

- **Date:** 2026-11-25
- **Decision:** `astro dev`, `build` and `preview` run on Node ≥ 22.18. Bun
  handles installs, `bun test`, scripts and Playwright.
- **Why:** `@cloudflare/config` refuses to load `cloudflare.config.ts` under
  Bun.

## 47. Schema version in a table

- **Date:** 2026-11-25
- **Decision:** migrations track the schema version in a `schema_version` table.
- **Why:** DO SQLite refuses `PRAGMA user_version` (`SQLITE_AUTH`).

## 48. Puzzle pages aren't edge-cached

- **Date:** 2026-11-25
- **Decision:** puzzle pages render per request; no cached shell, no
  HTMLRewriter.
- **Why:** warm SSR is 2–4 ms in workerd, far under the ~20 ms threshold.

## 49. The service worker precaches the whole build and keeps old builds

- **Date:** 2026-11-25
- **Decision:** precache every hashed asset of the build, not just the solver.
  Every page carries an `x-build` header; per-build asset lists live in
  IndexedDB and are pruned on activate.
- **Why:** the offline spike. A cached page must hydrate offline, and an old tab
  must keep loading its own assets after a deploy.

## 50. Temporary monorepo, no shared code

- **Date:** 2026-11-25
- **Decision:**
  - The repo split is the first PR (rollout step 0). The Deno app moves
    unchanged into `deno/`; the new app lives in `web/`. Each owns its whole
    toolchain. There is no root `package.json` or `deno.json`; the root keeps
    only repo-wide files.
  - No shared code. The new app copies what it needs from the Deno app once and
    then owns it. Nothing imports across `deno/` and `web/`.
  - Drift is handled by a rule, like data drift: a change to `game/` logic on
    the Deno app lands in both copies in the same PR, or gets a line in
    [parity.md](parity.md#game-changes-waiting-for-a-copy). No automated diff
    check; the copies differ on purpose.
  - Data and tests keep one copy until cleanup. The puzzle corpus and
    `candidates/` stay in `deno/`, which reads them from disk; the new app
    bundles puzzles at build time from `../deno/static/puzzles`. The e2e suite
    stays in `deno/` and runs against both URLs, until enough flows are ported.
  - One set of workflows at the root, with path filters per app.
  - Cleanup deletes `deno/`. `web/` keeps its name.
- **Alternatives:**
  - The root Bun workspace with shared imports (entries 3, 38, 39 and 41):
    superseded.
  - `apps/deno/` and `apps/web/`: an extra level that pays off only with more
    apps or shared packages.
  - Deno at the root and the new app in `next/`, excluded in `deno.json`: the
    fallback if Deno Deploy can't set an app directory.
- **Why:** the spikes showed what sharing across two runtimes costs: deps pinned
  in both `deno.json` and `package.json` (the Playwright skew), a formatter
  split (two formatters can't both pass one file), one shared 467 MB
  `node_modules`, the `node:test` port, 38 `tsc` errors from Deno globals,
  Oxlint ignoring `deno-lint-ignore`, and server-only code having to leave
  `game/` before the new app can use it. The new app also diverges on purpose
  (solver in the browser, the cookie split, one island root, retro themes cut,
  `ClientRouter`), so shared UI was worth less than assumed. Kasper: "I propose
  a temporary monorepo. Where we put deno under it's own app and the other too.
  No shared code, just slow duplication/parity with shared CI".
