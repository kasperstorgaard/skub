# Rollout

How we get from the Deno app to the [north star](architecture.md), touching
production only for the repo split and the switch. Tooling for each step is in
[harness.md](harness.md); flow-by-flow progress is in [parity.md](parity.md).

## Shape: a parallel build

- The new app is built beside the Deno app, in the same repo: `web/` beside
  `deno/`. The Deno app keeps shipping to players; apart from the move into
  `deno/` it is untouched.
- No shared code, so nothing runs on two runtimes. No Fresh-on-workerd bridge,
  no dual-runtime shims, no throwaway adapters.
- **The e2e suite is the parity check.** It asserts what players see. Each app
  has its own copy of the suite, kept in step by the parity rule (see
  [decisions.md](decisions.md#53-e2e-suites-are-duplicated-per-app)).
- The new app runs on `next.skub.app` with real data from a one-way import, run
  by hand.
- The switch is a DNS change, made when `next.skub.app` is bug-free.

## Repo shape

A temporary monorepo with no shared code (see
[decisions.md](decisions.md#50-temporary-monorepo-no-shared-code)):

```text
.github/workflows/   one set of workflows, path-filtered per app
.claude/skills/  docs/  specs/
CLAUDE.md  spec.md  TODO.md  README.md  LICENSE  paseo.json
.gitignore  .claudeignore  .mcp.json  .worktreeinclude  .vscode/
ricochet.code-workspace  skills-lock.json
deno/              today's tree, moved one level down unchanged
  CLAUDE.md        the Deno app's half of today's CLAUDE.md
  static/puzzles/  the puzzle corpus, until cleanup
  candidates/
  e2e/             the Deno app's e2e suite, as today
web/               the new app, Bun only
  CLAUDE.md
  package.json  bun.lock  tsconfig.json  (Oxlint config)
  e2e/             its own copy of the suite, on @playwright/test
  cloudflare.config.ts  astro.config.ts
  src/
    worker.ts  pages/  islands/  components/  game/  lib/  db/
```

- **Each app owns its whole toolchain.** No root `package.json`, no root
  `deno.json`. The root keeps only repo-wide files: docs, workflows, skills,
  editor and agent config.
- **CLAUDE.md splits.** The root keeps the repo-wide parts (branches and PRs,
  planning, skill triggers). Commands, layout, core types, puzzles and tech
  notes move to `deno/CLAUDE.md`. `web/CLAUDE.md` grows with the new app.
- **No shared code.** The new app copies what it needs from the Deno app once
  and then owns it. Nothing imports across `deno/` and `web/`. Drift is handled
  by a rule (see
  [features during the transition](#features-during-the-transition)), not a diff
  check: the copies differ on purpose.
- **Only data has one copy until cleanup:**
  - The puzzle corpus (`static/puzzles/`) and `candidates/` stay in `deno/`. The
    Deno app reads them from disk at runtime, and Deno Deploy most likely
    uploads only the app directory. The new app bundles puzzles at build time
    from `../deno/static/puzzles`; its dev-only authoring tool reads and writes
    them there.
- **The e2e suite is duplicated per app.** `deno/` keeps `e2e/` and the
  `routes/**/_e2e/` page objects, run against the Deno app's branch URL. `web/`
  has its own copy on `@playwright/test`, run against the new app's preview.
  Ported tests are copied as they are; an assertion changes only for deliberate
  differences, recorded in [parity.md](parity.md#deliberate-test-differences).
- **CI:** one set of workflows at the root, with path filters: Deno jobs (with
  the Deno suite) for `deno/**`, Bun jobs (Oxlint, Oxfmt, `tsc`, `bun test`,
  build, the web suite against the preview) for `web/**` (see
  [harness.md](harness.md#new-app-ci-pipeline)).

## Spikes (throwaway, done)

Run before the steps; the write-ups are in [spikes/](spikes/README.md).

| Spike                                   | Success criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Fallback                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Astro 7 on workerd                      | Under `astro dev` and `astro build`: a page, an island imported from outside the app directory, a `ClientRouter` navigation beside the `?dialog=` router, a no-JS form POST → 303, the solver lazy-loaded in a Web Worker. One Preact instance in dev and prod. Tailwind `@source` picks up the shared directories. JS ≤ 40 KB gz on the puzzle page, ≤ 25 KB on home. Puzzle page render time measured. `node:zlib` (progress cookie) works under `nodejs_compat`. | Dev server on Node, Bun for the rest. Render above ~20 ms: cache the page shell at the edge and fill the player's parts from cookies with HTMLRewriter. |
| `cf` + Vite plugin v2 + Astro adapter   | Build, local dev in workerd, deploy, and a per-branch preview with its own DO storage.                                                                                                                                                                                                                                                                                                                                                                              | `wrangler preview` for previews until `cf` can make them.                                                                                               |
| Service worker + `ClientRouter` offline | 20 puzzle pages cached. Offline navigation between them. An uncached page: the overlay on a `ClientRouter` navigation, offline Home on a full page load. View transitions work. An old tab survives a deploy (old assets still served).                                                                                                                                                                                                                             | None recorded.                                                                                                                                          |
| DO entrypoint on Astro 7                | `src/worker.ts` exports a SQLite DO next to `handle()`. Works under `astro dev` in workerd. `deleteAll()` resets it for e2e. The adapter works with Vite 8 and `cf`.                                                                                                                                                                                                                                                                                                | None recorded. The framework fallback is the nearest: own thin layer (Hono + Vite + Preact, ~800 lines).                                                |
| Shared signals audit                    | A list of which islands share signals. The puzzle page collapses to one island root.                                                                                                                                                                                                                                                                                                                                                                                | Own thin layer (Hono + Vite + Preact, ~800 lines). This spike decides Astro over it.                                                                    |
| Solver in the browser                   | Time and peak memory of the TS solver in a Web Worker on a mid-range phone, for hints on the hardest shipped puzzles and for an editor board that exhausts the budget. This sets the offline/phone hint budget. For Rust, also WASM size and a match with `game/solver.ts` on the same handful (most blockers, highest `minMoves`, a few typical).                                                                                                                  | The outcomes are the fallbacks: TS is fine → compact TS (packed integer states in typed arrays) → Rust → WASM.                                          |
| DO round trip                           | A DO with `locationHint: "weur"` on a per-branch preview: round trip from Denmark measured, per-preview storage confirmed.                                                                                                                                                                                                                                                                                                                                          | None recorded. Placement is revisited if non-EU traffic grows.                                                                                          |
| Bun + Playwright + `bun test`           | Playwright runs under Bun. The shared tests pass under `bun test`.                                                                                                                                                                                                                                                                                                                                                                                                  | Vitest as the test runner.                                                                                                                              |

## Steps

Each step is its own PR. Step 0 moves the Deno app into `deno/`. Steps 1–6 build
the new app and don't change the Deno app's behaviour. Production doesn't change
until step 7, apart from step 0's move.

### 0. Repo split

`git mv` the whole Deno app into `deno/`, unchanged. It touches:

- The Deno Deploy app directory (Settings → App Directory, today `(root)`) →
  `deno/`. Install and build commands stay `deno install` and `deno task build`,
  run from there.
- `pull-request.yml` and `e2e.yml`: `working-directory: deno/` plus path
  filters.
- `e2e/blast-radius.config.ts`: the globs get the `deno/` prefix, since
  `select-e2e-tests` sees repo-rooted git paths.
- `paseo.json`: the dev command becomes `cd deno && …`.
- `.vscode/settings.json`: `deno.enablePaths: ["deno/"]`.
- CLAUDE.md: split into the root and `deno/CLAUDE.md`; the skills: paths.

Code paths are cwd-relative (`Deno.cwd()`, `./static/puzzles`), so they keep
working.

Runbook notes:

- **The app directory setting is app-wide,** and PR 0's branch only builds after
  it flips. Order: flip the setting, rebuild PR 0's branch, check its branch
  URL, merge straight away. Nothing else merges in between.
- **Other open branches' previews break** until they're rebased onto the move;
  git's rename detection handles most of it.

### 1. Copy the core

Copy `game/` and the portable parts of `lib/` into `web/src/` and make the copy
Bun-clean. The Deno app doesn't change, so there are no dual-runtime
constraints:

- Tests use `bun:test`. `@std/assert` stays, from the JSR npm mirror
  (`@jsr/std__assert`, through `.npmrc`), so the port is a scripted import swap
  (`Deno.test(` → `test(` plus one import). Two tests that read files through
  Deno APIs switch to `node:fs`.
- Server-only code out of the copy's `game/` (decision 40), so the `game/`
  boundary rule is on from the start (it flags 7 violations today):
  - `game/cookies.ts`, `game/profile-cookie.ts` and `game/progress-cookie.ts`
    move out of `game/`, or take env and signing as parameters.
  - `loader.ts` and `solver-queue.ts` get `isDev` injected.
- Puzzles bundled at build time from `../deno/static/puzzles`, not read from
  disk. `names.ts` uses a JSON import.
- Temporal: Bun 1.4.5 has it natively. The polyfill is only for workerd, pending
  the Astro spike.
- See [spikes/bun-toolchain.md](spikes/bun-toolchain.md) for the evidence.

### 2. Skeleton

The new app boots on workerd with its own CI jobs:

- The env module, the app-environment flag and secrets.
- The puzzle bundle wired into the build.
- Static assets, Tailwind 4 and the CSS budget.
- `web/`'s copy of the e2e suite, ported to `@playwright/test` under Bun with
  the base URL as config. The Deno suite stays in `deno/` as is.
- The repo connected to Workers Builds: root directory `web/`, `cf` build and
  deploy commands (not the dashboard's default `wrangler`), preview builds only
  for changes under `web/`. Not before `web/` exists, or every PR gets a failing
  check.
- Previews through `cf previews deploy --preview-name <branch>`. The DO is
  reached through `exports`, never a named binding, so previews don't share
  storage
  ([decision 52](decisions.md#52-reach-the-do-through-exports-previews-through-cf-previews)).

### 3. Store

- The DO, reached through `exports.Store` (not a named binding), with its
  schema: user, solution, score, user_score, feedback, rating and auth tables.
- Migrations tracked in a `schema_version` table (DO SQLite refuses
  `PRAGMA user_version`).
- Typed SQL helpers, or Drizzle's durable-sqlite driver.
- The solve as one transaction.
- Store code on a minimal `exec(sql, ...params)` interface, with a handful of
  scenario tests on in-memory `bun:sqlite`.
- The KV import script: backup JSONL → SQL, bots dropped, the four solution
  indexes deduplicated, scores rebuilt, `auth` sub→userId and auth sessions
  kept, editor drafts into the user's `draft` column. Checked by counting
  solutions, players and score totals.

### 4. Pages, by flow

One PR per flow. The flow's e2e tests are copied from `deno/` to `web/` as they
are. A flow is ported when they pass on its preview and its
[parity.md](parity.md) rows are ticked.

Everything is ported before the switch, local flows included. Kasper:
"Everything gets ported before cutover, even local flows."

**E2E first for uncovered flows.** Every player-facing flow with no e2e today
gets its tests written against the Deno app before it is ported: hints, editor,
feedback, consent banner, cookie policy, login, "Play next", the share image,
the weekly high score, error pages and solution replay. The test must pass on
the Deno app, then are copied to `web/` and pass on the flow's preview. Keep it
lean: the core outcome only, from seeded state, per the existing e2e
conventions. Login seeds a session rather than driving Auth0.

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
   as dev-only pages rendered by Astro with the new app's UI, plus a dev-only
   Astro integration (`astro:server:setup`, in the Vite dev process on the host)
   for the save and promote endpoints that write `candidates/*.md` and
   `static/puzzles/*.md` in `deno/`. Excluded from production builds, so it has
   no preview e2e; it's done when saving and promoting work under `astro dev`.
   The scoring and calibration scripts move with it.

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
- Auth0 gets `next.skub.app` as an allowed callback.

### 7. Switch

The only step after step 0 that touches production. See
[the runbook](#switch-runbook).

### 8. Cleanup

After the switch, delete the Deno app entirely:

- Move what still lives in `deno/` into `web/`: the puzzle corpus and
  `candidates/`.
- Delete `deno/`, with its e2e suite, the Deno CI jobs and the KV Connect
  scripts.
- Moving `web/` to the repo root is optional.
- Update CLAUDE.md and the skills.

## `next.skub.app` and the one-way import

- `next.skub.app` serves the new app's production Worker.
- **The import** is a script run by hand when Kasper wants fresh data on `next`,
  plus the final import in the [switch runbook](#switch-runbook). `next`'s data
  is as fresh as the last run. It reads the Deno app's hourly backup from GCS
  and merges it into the DO:
  - One-way. Nothing flows back to the Deno app.
  - Idempotent: `INSERT OR IGNORE` on ids, scores rebuilt.
  - Bots dropped.
- **Log in on `next` to see your real account.** The `auth` sub→userId mapping
  moves with the data.
- **Writes made on `next` stay there** and never flow back.
- `next.skub.app` is a separate URL, not a feature flag on `skub.app`, so
  nothing new stands in front of production.

## Features during the transition

The port is planned at about a month. During it the Deno app ships only puzzles
and bug fixes
([decision 54](decisions.md#54-a-month-long-port-puzzles-and-bug-fixes-only)),
so these rules rarely fire. They still hold:

1. **A change to stored data on the Deno app** (a new KV key or field) adds its
   mapping to the import and the SQL schema in the same PR. Otherwise the data
   silently stops flowing to `next`.
2. **A change to `game/` logic on the Deno app** lands in both copies in the
   same PR, or gets a line in
   [parity.md](parity.md#game-changes-waiting-for-a-copy). There's no automated
   check: the copies differ on purpose.
3. **UI changes** land on the Deno app and get ported with their flow, or after
   it. A test change on the Deno app is copied to `web/` once the flow is
   ported, or gets a line in [parity.md](parity.md#deliberate-test-differences).

The Deno app keeps its retro themes until the switch. The new app doesn't port
them (see [decisions.md](decisions.md#25-retro-themes-are-cut)).

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

| Risk                          | Why it matters                                                                                                                                                                            | Mitigation                                                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solver on phones              | The solver runs only in the browser. Hard puzzles and big editor boards may be slow or run out of memory on mid-range phones.                                                             | The solver spike sets a lower offline/phone budget; positions over it say "No hint available from here". Compact TS if TS is too slow.             |
| `cf` and Vite plugin v2 beta  | Both are beta. Wrangler gets 18 months after the `cf` beta ends.                                                                                                                          | Spiked: `cf` replaces Wrangler fully. Deploy and previews checked; previews isolate DO storage only via `exports`, not a named binding.            |
| Astro adapter vs Vite 8       | `@astrojs/cloudflare` has to work with Vite 8, `cf` and the plugin v2, and export the DO.                                                                                                 | The DO entrypoint spike. Fallback: own thin layer (Hono + Vite + Preact, ~800 lines).                                                              |
| Single-DO ceiling             | ~1,000 req/s soft limit and 10 GB per object. `locationHint` is best effort and permanent once set.                                                                                       | Skub's write rate is far below the limit. Shard when a limit is measured: drafts first, then by puzzle. Revisit placement if non-EU traffic grows. |
| Data drift                    | The Deno app keeps shipping. A new KV key or field the import doesn't map silently stops flowing to `next`.                                                                               | The same-PR rule. Counts verified at every import.                                                                                                 |
| `game/` copy drift            | No code is shared. A rule change on the Deno app that misses the new app's copy plays differently on `next`.                                                                              | The same-PR rule, or a line in parity.md. A game rule's e2e test fails on `next` if the copy misses it.                                            |
| Test drift between the copies | The two e2e suites are separate copies. A test changed on one app and not the other stops them comparing.                                                                                 | The parity rule: ported tests are copied as they are; deliberate differences get a line in parity.md.                                              |
| PR 0's Deploy setting         | Deno Deploy's app directory is app-wide. Open branches' previews break until rebased, and PR 0 is a production deploy before the switch.                                                  | Confirm the setting exists first; fallback: Deno at the root, the new app in `next/`. Verify on PR 0's branch URL, flip the setting as it merges.  |
| Safari eviction               | Safari can evict a site's caches and IndexedDB. Cached pages and queued outbox writes would go with them. Safari also lacks the service worker `cookieStore`.                             | `navigator.storage.persist()` once the cache fills. The cache is insurance: online, pages always come from the network. Not discussed further.     |
| Safari, untested              | Is `Set-Cookie` stored on a manual-redirect replay from the service worker? No Background Sync. ITP can wipe storage after 7 days, the outbox included. View transitions need Safari 18+. | Replay with `redirect: "follow"` if cookies are lost. `visibilitychange` as a sync trigger.                                                        |
| Overlay hook                  | It temporarily replaces `window.fetch` to reuse Astro's loader, so an Astro upgrade can break it.                                                                                         | Offline e2e covers the overlay.                                                                                                                    |
| Second Preact in an old tab   | An old tab can load a second Preact if a deploy changes Preact's chunk hash.                                                                                                              | None recorded.                                                                                                                                     |
| Unreleased puzzles leaking    | Static files serve them today.                                                                                                                                                            | Puzzles bundled at build. The released puzzle list never lists them, and a test checks it.                                                         |
| Deadline                      | Deno Deploy shuts down around April 2027. Rollback ends with it.                                                                                                                          | The port is planned at about a month, leaving months of rollback window. The switch waits for bugs, not a date, but within that limit.             |
