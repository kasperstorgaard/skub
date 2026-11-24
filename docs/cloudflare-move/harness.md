# Harness

The tooling that makes the move safe and measurable. Each entry says what it is,
why we need it, when it lands (the [rollout](rollout.md) step), and when it's
done.

| Harness                                                                                          | Step     |
| ------------------------------------------------------------------------------------------------ | -------- |
| [Solver budget probe](#solver-budget-probe)                                                      | 0        |
| [DO round-trip probe](#do-round-trip-probe)                                                      | 0        |
| [Shared tests under `bun test`](#shared-tests-under-bun-test)                                    | 1        |
| [Import rules lint](#import-rules-lint)                                                          | 1–2      |
| [New app CI pipeline](#new-app-ci-pipeline)                                                      | 2        |
| [Per-branch previews and DO reset](#per-branch-previews-and-do-reset)                            | 2        |
| [E2E suite on `@playwright/test`](#e2e-suite-on-playwrighttest)                                  | 2        |
| [E2E for uncovered flows, on the Deno app first](#e2e-for-uncovered-flows-on-the-deno-app-first) | 4        |
| [Parity report](#parity-report)                                                                  | 2–7      |
| [Perf budget checks](#perf-budget-checks)                                                        | 2–7      |
| [Store scenario tests](#store-scenario-tests)                                                    | 3        |
| [KV → SQL import](#kv--sql-import)                                                               | 3        |
| [Data-drift check](#data-drift-check)                                                            | 3        |
| [Solver parity check](#solver-parity-check)                                                      | if Rust  |
| [Service worker manifest plugin](#service-worker-manifest-plugin)                                | 5        |
| [Released puzzle list endpoint](#released-puzzle-list-endpoint)                                  | 5        |
| [Offline e2e](#offline-e2e)                                                                      | 5        |
| [Import cron](#import-cron)                                                                      | 6        |
| [Backup cron](#backup-cron)                                                                      | 6        |
| [OTLP export](#otlp-export)                                                                      | 6        |
| [Read-only mode on the Deno app](#read-only-mode-on-the-deno-app)                                | before 7 |
| [Dev-only authoring integration](#dev-only-authoring-integration)                                | 8        |

## Solver budget probe

- **What:** a measurement run of the solver inside workerd: CPU and peak memory
  on the hardest puzzles and on an editor board that exhausts the budget. For
  Rust, also WASM size and cold start.
- **Why:** Workers caps an isolate at 128 MB. The editor budget (3M states) is
  ~175 MB today, and hints allow 7M states.
- **When:** step 0.
- **Done when:** the numbers pick one outcome: it fits, compact TypeScript, Rust
  → WASM, or a lower budget.

## DO round-trip probe

- **What:** a DO with `locationHint: "weur"` on a per-branch preview, timed from
  Denmark.
- **Why:** the solve POST budget (≤ 400 ms) and TTFB on the few store-backed
  GETs depend on it.
- **When:** step 0.
- **Done when:** the round trip is measured and per-preview storage is
  confirmed.

## Shared tests under `bun test`

- **What:** the unit tests for `game/` and the portable parts of `lib/` run
  under `bun test` as well as `deno test`. Plain `@std/assert` swapped for an
  npm equivalent. Vitest is the fallback runner.
- **Why:** shared code must keep working for both apps. The tests prove it.
- **When:** step 1 (spiked in step 0).
- **Done when:** every shared test passes under both runners, in both CI
  pipelines.

## Import rules lint

- **What:** a port of `plugins/lint-imports.ts` to an Oxlint JS plugin. Today it
  enforces the `#/` alias for cross-folder imports and two sorted import groups
  (third-party, then project).
- **Why:** the new app and shared code keep one import style under Oxlint.
- **When:** step 1 for shared code, step 2 in the new app's CI.
- **Done when:** Oxlint reports the same violations as `deno lint` on shared
  code, with autofix.
- **Open:** whether it also gains a boundary rule (shared code may not import
  Fresh or Deno APIs). Not discussed.

## New app CI pipeline

- **What:** the new app's own workflow: Oxfmt, Oxlint, `tsc`, `bun test`, build,
  CSS budget, a per-branch preview, and e2e against that preview.
- **Why:** two pipelines until the switch. Today's e2e trigger depends on Deno
  Deploy's `deployment_status` events, which the new app doesn't send.
- **When:** step 2.
- **Done when:** every PR touching the new app or shared code runs it, and its
  e2e job runs against that branch's preview.
- **Open:** whether the blast-radius test selector carries over.

## Per-branch previews and DO reset

- **What:** one Worker Preview per branch, each with its own DO storage, and a
  reset endpoint that calls `deleteAll()`. The reset needs the e2e secret and
  refuses outside a preview, like `/api/e2e/reset` today.
- **Why:** e2e starts from clean data on every branch. Today all previews share
  one database.
- **When:** spiked in step 0, wired in step 2.
- **Done when:** two branches' e2e runs can't see each other's data, and the
  reset refuses on production.
- Through `cf` if it can, else `wrangler preview`.

## E2E suite on `@playwright/test`

- **What:** today's e2e suite (Playwright library inside `Deno.test`) ported to
  `@playwright/test`, with the base URL as config. The seeding endpoints
  (`/api/e2e/users`, `/api/e2e/solutions`) exist on both apps.
- **Why:** it is the parity check. It asserts what players see, so one suite
  runs against both apps.
- **When:** step 2. Each flow's tests are added or extended in step 4.
- **Done when:** the suite passes against the Deno app's branch URL, and a
  flow's tests pass on the new app's preview before that flow counts as ported.

## E2E for uncovered flows, on the Deno app first

- **What:** e2e tests for the flows with none today, written against the Deno
  app before that flow is ported: hints, editor, feedback, consent banner,
  login, "Play next" (`/puzzles/recommended`), the weekly high score, error
  pages and solution replay. Lean: the core outcome only, from seeded state, per
  the existing e2e conventions. Login seeds a session rather than driving Auth0.
- **Why:** a port can only be checked against a test that already passes on the
  original. Otherwise the parity check has gaps exactly where nothing is tested.
- **When:** step 4, at the start of each flow's PR.
- **Done when:** the test passes on the Deno app, then on the flow's preview.
  [parity.md](parity.md) marks which rows need it.

## Parity report

- **What:** the result of each e2e test on both apps side by side, mapped to the
  rows of [parity.md](parity.md).
- **Why:** shows what is left before the switch, and catches a flow that passes
  on one app only.
- **When:** from step 2, updated with each flow in step 4.
- **Done when:** every parity row is either green on both apps or marked not
  kept. That's part of the switch criterion.
- **Open:** its form (a CI summary or a doc). Not discussed.

## Perf budget checks

- **What:** checks against the budgets in [mission.md](mission.md#goals):
  - JS ≤ 40 KB gz puzzle page, ≤ 25 KB home; CSS ≤ 16 KB gz entry and ≤ 6 KB gz
    per theme, as `scripts/check-css.ts` enforces today. In CI, on every build.
    The CSS check keeps today's unresolved `var(--…)` check.
  - Service worker: ≤ 5 KB gz added to the puzzle page, nothing on home before
    install. In CI from step 5.
  - Puzzle page render time in workerd: measured in step 0; above ~20 ms,
    revisit edge-caching the shell.
  - GET TTFB ≤ 150 ms warm from EU, solve POST ≤ 400 ms: measured on
    `next.skub.app` before the switch and on `skub.app` after it.
- **Why:** performance is the first principle. A budget nobody measures drifts.
- **When:** size checks in step 2, render time in step 0, TTFB and solve before
  step 7.
- **Done when:** size budgets fail the build when exceeded, and the TTFB and
  solve numbers are recorded for the switch.
- **Open:** how TTFB from EU is measured.

## Store scenario tests

- **What:** a handful of tests at the level of store operations, e.g. "a solve
  claims the path and ranks the player". Store code takes a minimal
  `exec(sql, ...params)` interface, so they run on in-memory `bun:sqlite`.
- **Why:** the solve transaction replaces KV retry loops and multi-key atomics.
  Kasper: "some, but don't start testing SQL lib, more like integration".
- **When:** step 3.
- **Done when:** the solve, dedup, path claim and score award each have a
  scenario. No test per query.

## KV → SQL import

- **What:** a script that reads the hourly backup (JSONL) and writes SQL: bots
  dropped, the four solution index copies deduplicated to one row, scores
  rebuilt, `auth` sub→userId and auth sessions kept, editor drafts into the
  user's `draft` column. Idempotent (`INSERT OR IGNORE` on ids).
- **Why:** the data moves one way, many times: on every import cron run and once
  more at the switch.
- **When:** step 3.
- **Done when:** after an import, solution, player and score totals match the
  backup, and a second import of the same backup changes nothing.

## Data-drift check

- **What:** a check that fails when the backup has a key family or a field the
  import doesn't map.
- **Why:** there's no feature freeze. A new KV key or field on the Deno app must
  add its mapping to the import and schema in the same PR, or it silently stops
  flowing to `next`.
- **When:** step 3. Runs in the Deno app's CI (against `db/backup-keys.ts`) and
  on every import cron run (against the real backup).
- **Done when:** adding a key family or field on the Deno app without a mapping
  fails CI, and an unmapped field in a real backup fails the import loudly.

## Solver parity check

- **What:** the Rust → WASM solver run against `game/solver.ts` on every puzzle
  file (all 340, unreleased included; it's offline dev tooling): same
  `minMoves`, same solvability.
- **Why:** the hints and editor badge must not change answers.
- **When:** only if the solver spike picks Rust.
- **Done when:** every puzzle file matches, in CI.

## Service worker manifest plugin

- **What:** a small Vite plugin that emits the hashed assets and a build
  version, inlined into `sw.ts`. Assets only: puzzles release daily without a
  deploy, so they come from the released puzzle list instead.
- **Why:** the service worker precaches assets from it and keeps old assets
  while cached pages reference them.
- **When:** step 5.
- **Done when:** the manifest matches the build and holds no puzzle URLs.

## Released puzzle list endpoint

- **What:** a small server endpoint, e.g. `/puzzles/released.json`, listing the
  released puzzle URLs. Cacheable until the next daily release. The service
  worker fetches it on activate, and when online at most once a day, then caches
  any pages it doesn't have yet.
- **Why:** a new puzzle releases every day without a deploy. A build-time list
  would lag until the next deploy.
- **When:** step 5.
- **Done when:** the list matches the released puzzles on any given day, a test
  fails if it ever lists an unreleased slug, and the day's new puzzle is cached
  without a deploy.

## Offline e2e

- **What:** Playwright offline emulation: play, solve, reconnect, sync. Plus the
  spike's checks kept as tests: offline navigation between cached pages, an
  uncached page landing on `/offline`, an old tab surviving a deploy.
- **Why:** the outbox and cache are invisible until they fail.
- **When:** step 5.
- **Done when:** a solve made offline shows as pending, syncs on reconnect, and
  appears on the solutions page.

## Import cron

- **What:** a Cron Trigger on the new app's production Worker that reads the
  Deno app's hourly backup from GCS and runs the KV → SQL import.
- **Why:** `next.skub.app` runs on near-live data, so bugs show on real players'
  data before the switch.
- **When:** step 6.
- **Done when:** `next.skub.app` lags the Deno app by at most one backup, and
  each run logs its counts and drift check result.

## Backup cron

- **What:** an hourly Cron Trigger that backs up the DO to GCS or R2 (open).
  Hourly and slower schedules get 15 min CPU.
- **Why:** replaces today's `Deno.cron` hourly backup of KV to GCS.
- **When:** step 6.
- **Done when:** an hourly backup lands, and a restore into a fresh DO on a
  preview gives the same counts.

## OTLP export

- **What:** Workers OTLP export (HTTP/JSON) to an external backend (open).
  PostHog accepts logs only, not traces.
- **Why:** off Deno Deploy, `@opentelemetry/api` silently no-ops. The perf work
  reads these traces.
- **When:** step 6.
- **Done when:** a page request and a solve show up as traces with their spans.

## Read-only mode on the Deno app

- **What:** a switch on the Deno app that refuses writes while pages still
  serve. This doesn't exist today and needs building.
- **Why:** the switch runbook starts with a read-only window, so the final
  backup holds every write.
- **When:** before step 7, as a PR on the Deno app.
- **Done when:** with it on, no KV write happens, and players see plainly that
  saving is paused.
- **Open:** how it's turned on, and what each write route shows.

## Dev-only authoring integration

- **What:** a small Astro integration on the `astro:server:setup` hook. It runs
  in the Vite dev process on the host, not in workerd, and provides the save and
  promote endpoints that write `candidates/*.md` and `static/puzzles/*.md`.
- **Why:** the authoring tool moves into the new app as dev-only pages, and
  workerd has no filesystem. This is what lets the Deno app be deleted.
- **When:** step 8, after the switch.
- **Done when:** saving and promoting a candidate work under `astro dev`, and a
  production build contains neither the authoring pages nor the endpoints.
