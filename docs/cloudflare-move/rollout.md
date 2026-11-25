# Rollout

How we get from the Deno app to the [north star](architecture.md) without
touching production until the switch. Tooling for each step is in
[harness.md](harness.md); flow-by-flow progress is in [parity.md](parity.md).

## Shape: a parallel build

- The new app is built beside the Deno app, in the same repo. The Deno app keeps
  shipping to players, untouched. Nothing on `main` has to run on two runtimes.
- No Fresh-on-workerd bridge, no dual-runtime shims, no throwaway adapters.
- **The e2e suite is the parity check.** It asserts what players see, so the
  same tests run against both apps.
- The new app runs on `next.skub.app` with near-live data from a one-way import.
- The switch is a DNS change, made when `next.skub.app` is bug-free.

## Repo shape

- **The repo-root `package.json` is the Bun workspace root,** and the new app is
  a member in its own directory with its own `package.json` and
  `cloudflare.config.ts`. Bun resolves `game/`'s deps by walking up from the
  importing file, so shared deps live in the root `node_modules`. `bun.lock` is
  committed. The Deno app stays at the root until cleanup.
- **Deps used by both sides are pinned to the same version** in `deno.json` and
  `package.json`. An unpinned `@playwright/test` moved Deno's Playwright from
  1.59.1 to 1.65.1, which needs a different Chromium.
- **One formatter per file** (proposed, pending owner): `deno fmt` owns the Deno
  app and shared code until cleanup, Oxfmt owns only the new app's directory,
  and shared code is reformatted once by Oxfmt at cleanup. The two formatters
  can't both pass on one file.
- Shared, pure code is imported by both apps, never copied: `game/`, the
  portable parts of `lib/`, and the Preact components and islands the new app
  can render. Bare specifiers resolve under both `deno.json` and `package.json`,
  plus the `#/` alias.
- Two CI pipelines. The Deno workflows stay as they are. The new app gets its
  own (see [harness.md](harness.md#new-app-ci-pipeline)).

## Steps

Each step is its own PR. Steps 1–6 touch only the new app and shared code.
Production doesn't change until step 7.

### 0. Spikes (throwaway)

| Spike                                   | Success criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Fallback                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Astro 6 on workerd under Bun            | Under `bunx --bun astro dev` and `astro build`: a page, an island imported from outside the app directory, a `ClientRouter` navigation beside the `?dialog=` router, a no-JS form POST → 303, the solver lazy-loaded in a Web Worker. One Preact instance in dev and prod. Tailwind `@source` picks up the shared directories. JS ≤ 40 KB gz on the puzzle page, ≤ 25 KB on home. Puzzle page render time measured. `node:zlib` (progress cookie) works under `nodejs_compat`. | Dev server on Node, Bun for the rest. Render above ~20 ms: cache the page shell at the edge and fill the player's parts from cookies with HTMLRewriter. |
| `cf` + Vite plugin v2 + Astro adapter   | Build, local dev in workerd, deploy, and a per-branch preview with its own DO storage.                                                                                                                                                                                                                                                                                                                                                                                         | `wrangler preview` for previews until `cf` can make them.                                                                                               |
| Service worker + `ClientRouter` offline | 20 puzzle pages cached. Offline navigation between them. An uncached page: the overlay on a `ClientRouter` navigation, offline Home on a full page load. View transitions work. An old tab survives a deploy (old assets still served).                                                                                                                                                                                                                                        | None recorded.                                                                                                                                          |
| DO entrypoint on Astro 6                | `src/worker.ts` exports a SQLite DO next to `handle()`. Works under `astro dev` in workerd. `deleteAll()` resets it for e2e. The adapter works with Vite 8 and `cf`.                                                                                                                                                                                                                                                                                                           | None recorded. The framework fallback is the nearest: own thin layer (Hono + Vite + Preact, ~800 lines).                                                |
| Shared signals audit                    | A list of which islands share signals. The puzzle page collapses to one island root.                                                                                                                                                                                                                                                                                                                                                                                           | Own thin layer (Hono + Vite + Preact, ~800 lines). This spike decides Astro over it.                                                                    |
| Solver in the browser                   | Time and peak memory of the TS solver in a Web Worker on a mid-range phone, for hints on the hardest shipped puzzles and for an editor board that exhausts the budget. This sets the offline/phone hint budget. For Rust, also WASM size and a match with `game/solver.ts` on the same handful (most blockers, highest `minMoves`, a few typical).                                                                                                                             | The outcomes are the fallbacks: TS is fine → compact TS (packed integer states in typed arrays) → Rust → WASM.                                          |
| DO round trip                           | A DO with `locationHint: "weur"` on a per-branch preview: round trip from Denmark measured, per-preview storage confirmed.                                                                                                                                                                                                                                                                                                                                                     | None recorded. Placement is revisited if non-EU traffic grows.                                                                                          |
| Bun + Playwright + `bun test`           | Playwright runs under Bun. The shared tests pass under `bun test`.                                                                                                                                                                                                                                                                                                                                                                                                             | Vitest as the test runner.                                                                                                                              |

### 1. Shared core

Make `game/` and the portable parts of `lib/` import cleanly from Bun:

- Bare specifiers and the `#/` alias. `@std/*` imports stay as they are and
  resolve from the JSR npm mirror (e.g. `@jsr/std__assert`, through `.npmrc`).
- The one Fresh import in shared code (`islands/solution-dialog.tsx`) removed.
- The solver's state key made exact for any piece count (it breaks above 8
  pieces today; decision 43), with a scenario test on Ulf and Nis.
- Puzzles loaded through an injected source instead of disk reads. `names.ts`
  uses a JSON import.
- Server-only code out of `game/`, so the `game/` boundary rule can be turned on
  (it flags 7 violations today):
  - `game/cookies.ts`, `game/profile-cookie.ts` and `game/progress-cookie.ts`
    move out of `game/`, or take env and signing as parameters.
  - `loader.ts` and `solver-queue.ts` get `isDev` injected.
- Temporal: Bun 1.4.5 has it natively. The polyfill is only for workerd, pending
  the Astro spike.
- Unit tests runnable by `bun test`: each shared test imports `test` from
  `node:test` (not `bun:test`), so one file runs under both `deno test` and
  `bun test`. The port is scripted; about half a day for the ~30 shared test
  files. Two tests that read files through Deno APIs switch to `node:fs`.
- See [spikes/bun-toolchain.md](spikes/bun-toolchain.md) for the evidence.

This lands on `main`, and the Deno app keeps working.

### 2. Skeleton

The new app boots on workerd with its own CI pipeline:

- The env module, the app-environment flag and secrets.
- Puzzles bundled at build time.
- Static assets, Tailwind 4 and the CSS budget.
- The e2e suite ported to `@playwright/test`, with the base URL as config.

### 3. Store

- The DO with its schema: user, solution, score, user_score, feedback, rating
  and auth tables.
- Migrations on `PRAGMA user_version`.
- Typed SQL helpers, or Drizzle's durable-sqlite driver.
- The solve as one transaction.
- Store code on a minimal `exec(sql, ...params)` interface, with a handful of
  scenario tests on in-memory `bun:sqlite`.
- The KV import script: backup JSONL → SQL, bots dropped, the four solution
  indexes deduplicated, scores rebuilt, `auth` sub→userId and auth sessions
  kept, editor drafts into the user's `draft` column. Checked by counting
  solutions, players and score totals.

### 4. Pages, by flow

One PR per flow. A flow is ported when its e2e tests pass on its preview and its
[parity.md](parity.md) rows are ticked.

Everything is ported before the switch, local flows included. Kasper:
"Everything gets ported before cutover, even local flows."

**E2E first for uncovered flows.** Every player-facing flow with no e2e today
gets its tests written against the Deno app before it is ported: hints, editor,
feedback, consent banner, cookie policy, login, "Play next", the share image,
the weekly high score, error pages and solution replay. The test must pass on
the Deno app, then on the flow's preview. Keep it lean: the core outcome only,
from seeded state, per the existing e2e conventions. Login seeds a session
rather than driving Auth0.

1. Play and solve.
2. Hints and Flash. Hints move to the browser: the solver in a Web Worker, the
   hint POST records the spend only, and there are no hints without JS.
3. Solutions and high score.
4. Archive and home.
5. Login and profile.
6. Editor, including submit. The editor solve moves to the Web Worker;
   `POST /api/solve` and the streamed solve are removed.
7. Feedback and policy pages.
8. Authoring (dev-only): the authoring tool (candidates, scoring, the metric
   catalog, calibration scripts, the `/candidates` routes and the promote flow)
   as dev-only pages rendered by Astro with the shared UI, plus a dev-only Astro
   integration (`astro:server:setup`, in the Vite dev process on the host) for
   the save and promote endpoints that write `candidates/*.md` and
   `static/puzzles/*.md`. Excluded from production builds, so it has no preview
   e2e; it's done when saving and promoting work under `astro dev`. The scoring
   and calibration scripts move with it.

### 5. Offline

- The service worker and its build manifest (assets only).
- The released puzzle list endpoint (e.g. `/puzzles/released.json`), so each
  day's new puzzle is cached without a deploy.
- Action descriptors in `game/actions/`, and `submitForm()` for every
  offline-capable write.
- The outbox: ~5 s write timeout, queue in IndexedDB, 202 Queued, stay in place,
  replay on `online` and on any successful request.
- Navigation: network first with a ~400 ms cache fallback; the offline overlay
  for `ClientRouter` navigations; offline Home for full page loads.
- Offline Home (`/?offline&return=<url>`) and the offline solution dialog.
- "Play next" as a concrete link.
- Prefetch for the likely next page.
- The solver precached for offline hints, with the offline/phone budget.
- Login said plainly as online-only.
- The offline e2e scenarios in [harness.md](harness.md#offline-e2e).
- Budget: ≤ 5 KB gz added to the puzzle page, nothing on home before the service
  worker installs.

### 6. Platform

- Edge cache for shared DO query results.
- Static pages prerendered at build.
- Early Hints for CSS and fonts.
- The backup cron.
- OTLP tracing.
- PostHog via `waitUntil`, with the `/ph` proxy kept.
- The one-way import cron.
- Auth0 gets `next.skub.app` as an allowed callback.

### 7. Switch

The only step that touches production. See [the runbook](#switch-runbook).

### 8. Cleanup

After the switch, delete the Deno app entirely:

- The Deno app, `deno.json`, the Deno CI and the KV Connect scripts.
- Reformat the shared code once with Oxfmt (if the formatter split is
  confirmed).
- Move the new app to the repo root if wanted.
- Update CLAUDE.md and the skills.

## `next.skub.app` and the one-way import

- `next.skub.app` serves the new app's production Worker.
- **The import cron** reads the Deno app's hourly backup from GCS and merges it
  into the DO:
  - One-way. Nothing flows back to the Deno app.
  - Idempotent: `INSERT OR IGNORE` on ids, scores rebuilt.
  - Bots dropped.
- **Log in on `next` to see your real account.** The `auth` sub→userId mapping
  moves with the data.
- **Writes made on `next` stay there** and never flow back.
- `next.skub.app` is a separate URL, not a feature flag on `skub.app`, so
  nothing new stands in front of production.

## Features during the transition

No feature freeze. Two rules keep both apps in step:

1. **A change to stored data on the Deno app** (a new KV key or field) adds its
   mapping to the import and the SQL schema in the same PR. Otherwise the data
   silently stops flowing to `next`. The data-drift check enforces this.
2. **UI-only changes** land in shared code where they can. Otherwise they get
   ported when their flow is, or after it.

The Deno app keeps its retro themes until the switch, with no freeze on them.
The new app doesn't port them (see
[decisions.md](decisions.md#25-retro-themes-are-cut)).

## Switch runbook

Preconditions: the [switch criterion](mission.md#the-switch-criterion) holds.

1. **Read-only window.** Turn on read-only mode on the Deno app. Players can
   still read and play; writes are refused.
2. **Final backup** of Deno KV.
3. **Final import** into the DO.
4. **Verify counts:** solutions, players and score totals match the backup.
5. **DNS:** point `skub.app` at the Worker. It's on Cloudflare DNS already.
6. **Check** the perf budgets on `skub.app`: GET TTFB ≤ 150 ms warm from EU,
   solve POST ≤ 400 ms.

The signing key is the same `COOKIE_SIGNING_KEY`, so every signed cookie stays
valid. Auth sessions are imported, so nobody has to log in again.

## Rollback

Point `skub.app` back at the Deno app and turn its read-only mode off. It loses
only the writes made on the new app since the switch. Rollback is possible only
while Deno Deploy runs (until ~April 2027).

## Risks

| Risk                         | Why it matters                                                                                                                                                | Mitigation                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solver on phones             | The solver runs only in the browser. Hard puzzles and big editor boards may be slow or run out of memory on mid-range phones.                                 | The solver spike sets a lower offline/phone budget; positions over it say "No hint available from here". Compact TS or Rust → WASM if TS is too slow. Rust is checked against `game/solver.ts` on every puzzle file. |
| `cf` and Vite plugin v2 beta | Both are beta. Wrangler gets 18 months after the `cf` beta ends.                                                                                              | Spike first. Wrangler only where `cf` lacks a feature (e.g. `wrangler preview`).                                                                                                                                     |
| Astro adapter vs Vite 8      | `@astrojs/cloudflare` has to work with Vite 8, `cf` and the plugin v2, and export the DO.                                                                     | The DO entrypoint spike. Fallback: own thin layer (Hono + Vite + Preact, ~800 lines).                                                                                                                                |
| Single-DO ceiling            | ~1,000 req/s soft limit and 10 GB per object. `locationHint` is best effort and permanent once set.                                                           | Skub's write rate is far below the limit. Shard when a limit is measured: drafts first, then by puzzle. Revisit placement if non-EU traffic grows.                                                                   |
| Data drift                   | The Deno app keeps shipping. A new KV key or field the import doesn't map silently stops flowing to `next`.                                                   | The same-PR rule, enforced by the data-drift check. Counts verified at every import.                                                                                                                                 |
| Safari eviction              | Safari can evict a site's caches and IndexedDB. Cached pages and queued outbox writes would go with them. Safari also lacks the service worker `cookieStore`. | `navigator.storage.persist()` once the cache fills. The cache is insurance: online, pages always come from the network. Not discussed further.                                                                       |
| Unreleased puzzles leaking   | Static files serve them today.                                                                                                                                | Puzzles bundled at build. The released puzzle list never lists them, and a test checks it.                                                                                                                           |
| Deadline                     | Deno Deploy shuts down around April 2027. Rollback ends with it.                                                                                              | The switch waits for bugs, not a date, but within that limit.                                                                                                                                                        |
