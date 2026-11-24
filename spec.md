# Move Skub to Cloudflare

Deno Deploy shuts down in April 2027 and Deno runtime development ends a year
after the October 2026 Deno–Cloudflare deal. Fresh won't be maintained either.
Skub needs a new runtime, host, store, framework and toolchain.

Instead of migrating the live app piece by piece, build the new app in parallel
in the same repo, run both CI pipelines, and swap when the new one is good
enough.

Principles: performance (server and client), server first, simple at a glance,
bold.

## Target architecture

| Concern | Today | Target |
|---|---|---|
| Runtime + host | Deno Deploy isolate (Amsterdam) | Cloudflare Workers (workerd), nearest colo |
| Store | Deno KV (Virginia) | One SQLite-backed Durable Object, placed in western Europe |
| Framework | Fresh 2.3 | Astro 6 + `@astrojs/preact` + `@astrojs/cloudflare`; TSX components and islands, thin `.astro` page shells |
| Static assets | `staticFiles()` | Workers Static Assets |
| Puzzles | `.md` files read from disk at runtime | Bundled at build time (generated module) |
| Cron | `Deno.cron` | Cron Trigger → backup to GCS (or R2) |
| Previews + e2e | Deploy previews sharing one KV | Worker Previews: one per branch, own DO storage |
| Tracing | Deploy's built-in OTEL | Workers OTLP export to an external backend |
| Caching | Immutable assets only | Edge cache for shared pages that read the DO; Early Hints; Astro prefetch; service worker page cache in the browser |
| Offline | None | Service worker page cache + an outbox for solves |
| Platform CLI | `deno deploy`, Deploy console | `cf` CLI with `cloudflare.config.ts` and `@cloudflare/vite-plugin` v2 (both beta); Wrangler only where `cf` lacks a feature |
| Toolchain | `deno fmt/lint/test`, JSR | Bun (installs, scripts, `bun test`) + Vite 8, Oxlint + Oxfmt, TypeScript 7 |

### Why this shape

- **Anonymous GETs never touch the store** (signed profile and progress
  cookies). On Workers they render at the colo nearest the player, with no
  store hop, which helps players in North America and Oceania as much as EU
  players.
- **One Durable Object as the whole database.** SQLite runs in the same process
  as the object. A solve becomes one synchronous transaction: insert the
  solution once, claim the path, award the score. No versionstamps, no retry
  loops, no four copies of a solution, no best-effort follow-up writes. The
  `/highscore` and solutions pages become indexed SQL queries. Skub's write rate
  is far below the ~1,000 req/s soft limit for one object. Sharding (drafts
  first, then by puzzle) stays available if a measured limit ever appears.
- **EU placement** swaps today's ~110 ms transatlantic hop per KV call for an
  intra-EU hop. Only solves, logins, cookie refreshes, drafts, `/highscore` and
  solutions pages pay it.
- **Worker Previews** give each branch its own empty DO storage automatically,
  so e2e starts from clean data per branch. `/api/e2e/reset` becomes
  `deleteAll()`.
- **Astro 6** is owned by Cloudflare (January 2026), runs workerd in dev,
  prerender and production, keeps Preact islands, and has a Bun recipe. Pages
  become thin `.astro` shells, while components, islands, `game/` and `lib/`
  stay TSX. Astro islands don't share signals the way Fresh's do, so a page
  with shared state gets one island root that owns the signals and renders the
  board and dialogs as ordinary children. Skub's own `?dialog=` router stays.
  `ClientRouter` replaces Partials and brings view transitions. Rejected:
  Remix 3 (no `@preact/signals`, so every island would be rewritten, plus
  Node-only tooling), HonoX (alpha) and a Fresh fork (dead upstream). The
  fallback is a thin layer of our own (Hono + Vite + Preact, about 800 lines to
  own) if Astro's islands don't hold up.
- **Rust only where it pays: the solver.** The BFS is the one CPU- and
  memory-bound piece, and it's what pushes against the 128 MB isolate limit.
  As Rust compiled to WASM, imported by the Worker, it holds states as packed
  integers in a compact hash set. The rest of the server (pages, form POSTs,
  auth, the DO's SQL) stays TypeScript. Those parts are I/O-bound and share
  types and rules with the islands. Splitting them into a Rust API would add a
  service boundary and a second copy of the domain types, for no speed a
  player would notice.
- **`cf` over Wrangler.** `cf` is Cloudflare's successor to Wrangler. It's
  built on Vite and generated from the full API. Wrangler gets 18 months of
  maintenance once the `cf` beta ends. Starting on `cf` avoids a second
  tooling migration. Wrangler stays available for anything `cf` doesn't cover
  yet.
- **Offline-first where it's cheap.** Skub's writes only add facts (a solve
  never changes, and the server can verify it by replaying the moves), and
  shared data (paths, the high score) is derived from them. So writes can be
  eventually consistent with no conflict handling. Pages stay server-rendered.
  The service worker only caches them and never renders. Without JS, nothing
  changes.
- **The self-hosting path stays open:** workerd plus celld is single-object
  Durable Objects on object storage, which is exactly this shape.

### Why in parallel

- The Deno app keeps shipping to players untouched. Nothing on `main` has to
  work on two runtimes at once.
- The new app is built for its target from the start, so no Fresh-on-workerd
  bridge, no dual-runtime shims and no throwaway adapters.
- **The e2e suite is the parity check.** It asserts what players see, so the
  same Playwright tests run against both apps. The swap is ready when they pass
  on the new one.
- The swap is a DNS change, and rolling it back is the same change in reverse.

### Write model

Offline-first sets the rules for every write:

- **Self-contained requests.** A write carries everything the server needs.
  Puzzle, moves, name and flash start for a solve. The server verifies it on
  its own terms, for example by replaying the moves, and never depends on an
  earlier request.
- **One endpoint per write, whatever the source.** A no-JS form POST, an
  island's fetch and an outbox replay hit the same handler with the same
  fields.
- **Replay-safe.** Each write carries a client-made id, and the store's unique
  indexes make a duplicate a no-op.
- **The client predicts, the server confirms.** `game/` runs on both sides, so
  the island shows the result at once. The response only updates the cookie
  and derived data.
- **Online-only is a short, named list:** hints, login and the editor solve.
- **IndexedDB holds the outbox queue and nothing else.** It's the one exception
  to "server-set cookies only".

### Non-goals

- Redesigning game rules or UI during the move. Ports first, then improvements.
- Redesigning data beyond what SQL makes natural (one solutions table, derived
  paths, a ranked score table).
- Migrating the ~1M bot `user` records. Only players with a solution or a login
  move.

## Plan

### Repo shape

- The new app lives in its own directory as a Bun workspace with its own
  `package.json` and `cloudflare.config.ts`. The Deno app stays at the root until the
  swap.
- **Shared, pure code is imported by both apps, not copied:** `game/`, the
  portable parts of `lib/`, and the Preact components and islands the new
  framework can render. Shared code uses bare specifiers that resolve under
  both `deno.json` and `package.json`, plus the `#/` alias.
- New features during the transition go into shared code where they can, so
  they don't have to be built twice.
- Two CI pipelines. The existing Deno workflows stay as they are. The new app
  gets its own: Oxfmt, Oxlint, `tsc`, `bun test`, build, CSS budget, a Worker
  Preview per branch, and e2e against that preview.

### Steps

Each step is its own PR. Steps 1–6 touch only the new app and shared code, and
production doesn't change until step 7.

0. **Spikes (throwaway):**
   - Astro 6 on workerd under `bunx --bun astro dev` and `astro build`:
     - A page.
     - An island imported from outside the app directory.
     - A `ClientRouter` navigation alongside the `?dialog=` router.
     - A no-JS form POST → 303.
     - The streamed solve.

     Also confirm:
     - A single Preact instance in dev and prod.
     - Tailwind `@source` picking up the shared directories.
     - Puzzle page JS within 40 KB gz and home within 25 KB.
     - Puzzle page render time in workerd. Above ~20 ms, revisit caching the
       page shell at the edge with HTMLRewriter filling in the player's parts
       from cookies.
   - `cf` + Vite plugin v2 with the Astro Cloudflare adapter: build, local
     dev in workerd, deploy, and a per-branch preview with its own DO storage.
     If `cf` can't make previews yet, previews go through `wrangler preview`
     until it can.
   - Shared signals: audit which islands share signals, and check that the
     puzzle page collapses to one island root. This decides Astro over the
     fallback.
   - Solver memory and CPU. Workers caps memory at 128 MB per isolate. The
     editor budget (3M states) is about 175 MB today, and hints allow 7M states.
     The spike decides between four outcomes: it fits, it fits with a compact
     visited set (packed integer states in typed arrays), it moves to Rust →
     WASM, or the budget comes down. For Rust, port the BFS and its slide
     logic, then check it against `game/solver.ts` on all 340 shipped puzzles
     (same `minMoves`, same solvability). Measure peak memory, CPU, WASM size
     and cold start inside workerd.
   - A DO with `locationHint: "weur"` on a Worker Preview: the round trip from
     Denmark, and per-preview storage.
   - Bun with Playwright and `bun test` on the shared tests. If Astro's dev
     server misbehaves on Bun, it runs on Node and Bun keeps everything else.
1. **Shared core.** Make `game/` and the portable parts of `lib/` import
   cleanly from Bun:
   - Bare specifiers and the `#/` alias, with JSR `@std/*` swapped for npm.
   - The one Fresh import in shared code (`islands/solution-dialog.tsx`)
     removed.
   - Puzzles and names loaded through an injected source instead of disk
     reads.
   - Temporal via a polyfill where it's missing.
   - Unit tests runnable by `bun test`.

   This lands on `main`, and the Deno app keeps working.
2. **Skeleton.** The new app boots on workerd and has its own CI pipeline. It
   has:
   - The env module, the app-environment flag and secrets.
   - Puzzles bundled at build time.
   - Static assets, Tailwind 4 and the CSS budget.
   - The e2e suite ported to `@playwright/test`, with the base URL as config.
3. **Store.**
   - The DO with its schema: user, solution, score, user_score, feedback,
     rating and auth tables.
   - Migrations on `PRAGMA user_version`.
   - Typed SQL helpers, or Drizzle's durable-sqlite driver.
   - The solve as one transaction.
   - The KV import script: backup JSONL → SQL, with bots dropped, the four
     solution indexes deduplicated, scores rebuilt and `auth` sub→userId kept.
     Checked by counting solutions, players and score totals.
4. **Pages, by flow.** Each flow is one PR, and the port is done when that
   flow's e2e tests pass on its preview:
   1. Play and solve.
   2. Hints and Flash.
   3. Solutions and high score.
   4. Archive and home.
   5. Login and profile.
   6. Editor.
   7. Feedback and policy pages.
5. **Offline.**
   - **Service worker.**
     - Precaches the build's assets.
     - Puzzle pages: cache first, refreshed in the background. Filled early
       when the browser is idle (today's daily and recent archive puzzles),
       skipped on Save-Data or slow connections.
     - Home and archive: network first, falling back to cache, since they
       change with the daily release.
     - A solve POST evicts that puzzle's cached page.
     - Client navigations (`ClientRouter`) fetch HTML through the service
       worker, so a cached page swaps in instantly. There's no client-side
       rendering path: the HTML is always the server's.
     - Serves an `/offline` page.
     - Is versioned per build.
     - Never caches unreleased puzzles or other players' data.
   - **Astro prefetch** (hover, viewport, or Speculation Rules) for the
     likely next page: the next released puzzle, the archive, and the
     solutions page after a solve.
   - **Outbox: a queue of requests, owned by the service worker.**
     - A failed POST to an allowlisted route (solve, feedback, profile name) is
       stored in IndexedDB via `idb-keyval`: method, URL, body and an id. The
       service worker answers with a pending response, or the usual 303 for a
       form POST.
     - The queue replays in order on `online` and on the next navigation,
       with Background Sync as a Chromium-only bonus. A 2xx clears an entry, a
       4xx drops it, and a network error or 5xx keeps it.
     - Replays carry the current cookies, and the browser stores the response's
       `Set-Cookie`, so the progress cookie updates on sync.
     - Path claims go by server receipt, so a late solve quietly misses the
       claim.
   - **Pending solves** show as a plain fact ("saved on this device") until
     the server confirms them and the progress cookie updates.
   - **Online-only, said plainly:** hints, login, the editor solve and
     feedback.
   - **e2e:** Playwright offline emulation covers play, solve, reconnect and
     sync.
   - **Budget:** ≤ 5 KB gz added to the puzzle page, and nothing on home
     before the service worker installs.
6. **Platform.**
   - Edge cache for shared, cookie-free pages that read the DO: `/highscore`,
     solutions pages, the archive list. A 30–60 s TTL with
     stale-while-revalidate. Puzzle pages aren't edge-cached: they render
     from bundled data and cookies with no store call, so a cache hit would
     save only render CPU.
   - Static pages (cookie policy and similar) prerendered at build.
   - Early Hints for CSS and fonts.
   - Cron backup.
   - OTLP tracing.
   - PostHog via `waitUntil`, with the `/ph` proxy kept.
   - A staging Worker refreshed from the hourly backup, so the swap is
     rehearsed on real data.
7. **Swap.** This is the only step that touches production:
   1. A short read-only window.
   2. The final backup.
   3. Import, then verify the counts.
   4. Point `skub.app` at the Worker. It's on Cloudflare DNS already.

   The signing key is the same `COOKIE_SIGNING_KEY`, so every signed cookie
   stays valid. Auth sessions may be dropped, which means one re-login.
   Afterwards, check the perf budgets: GET TTFB ≤ 150 ms warm from EU, and solve
   POST ≤ 400 ms.
8. **Cleanup.**
   - Delete the Deno app, `deno.json`, the Deno CI and the KV Connect scripts.
   - Move the new app to the repo root if wanted.
   - Update CLAUDE.md and the skills.

## Open decisions

- DO placement: `locationHint: "weur"` (best effort), or the `eu` jurisdiction
  (hard EU residency, permanent).
- Store tests: run the SQL layer against in-memory SQLite in unit tests, or
  keep store code out of unit tests as today.
- How strictly to freeze features on the Deno app during the transition.
- Solver: compact TypeScript, or Rust → WASM (decided by the spike).
