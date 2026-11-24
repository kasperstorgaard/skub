# Move Skub to Cloudflare

Deno Deploy shuts down in April 2027 and Deno runtime development ends a year
after the October 2026 Deno–Cloudflare deal. Skub needs a new runtime, host and
store, and the toolchain has to leave Deno too. This spec picks the target
architecture and splits the move into layers that each ship on their own.

Principles: performance (server and client), server first, simple at a glance,
bold where it pays.

## Target architecture

| Concern | Today | Target |
|---|---|---|
| Runtime + host | Deno Deploy isolate (Amsterdam) | Cloudflare Workers (workerd), nearest colo |
| Store | Deno KV (Virginia) | One SQLite-backed Durable Object, placed in western Europe |
| Framework | Fresh 2.3 | Fresh 2.3 on workerd as a bridge for the move, then replaced (layer 5) |
| Static assets | `staticFiles()` | Workers Static Assets |
| Puzzles | `.md` files read from disk at runtime | Bundled at build time (generated module) |
| Cron | `Deno.cron` | Cron Trigger → backup to GCS (or R2) |
| Previews + e2e | Deploy previews sharing one KV | Worker Previews: one per branch, own DO storage |
| Tracing | Deploy's built-in OTEL | Workers OTLP export to an external backend |
| Toolchain | `deno fmt/lint/test`, JSR | Node + Vite 8, Vitest, Oxlint + Oxfmt, TypeScript 7 (optionally all through Vite+ `vp`) |

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
- **Fresh is a bridge, not the destination.** It won't be maintained after the
  Deno deal, but it documents running on Workers. Keeping it through the
  cutover means one big change at a time. The replacement is its own layer.
- **The self-hosting path stays open:** workerd plus celld is single-object
  Durable Objects on object storage, which is exactly this shape.

### Non-goals

- Changing framework in the same PRs as the store or host.
- Redesigning data beyond what SQL makes natural (one solutions table, derived
  paths, a ranked score table).
- Migrating the ~1M bot `user` records. Only players with a solution or a login
  move.

## Layers

Each layer is its own branch in one stack (generic changes at the bottom), and
each one is reviewable alone. Layers 1–2 merge while production is still on
Deno Deploy. Layer 4 is the cutover.

### 0. Spikes (throwaway, not merged)

- **Fresh on workerd:** build with `fresh()` + `cloudflare()`. Run the home
  page, a puzzle page, one island, a Partial navigation, a no-JS form POST and
  the streamed `/api/solve` in local workerd. Check that the custom Vite plugins
  survive. Also choose `@cloudflare/vite-plugin` v1 + wrangler or v2 beta + `cf`.
- **Solver budget:** measure CPU and peak memory for hints on the hardest
  shipped puzzles and for a budget-exhausting editor board. Workers caps memory
  at 128 MB per isolate. The editor budget (3M states) is ~175 MB today and
  hints allow 7M states. Outcome: fits in-request, fits after a compact
  visited set (packed integer states in typed arrays), or needs a lower
  budget.
- **DO smoke test:** one SQLite DO with `locationHint: "weur"` on a Worker
  Preview. Measure the Worker→DO round trip from Denmark and confirm the
  preview gets its own storage.

### 1. Portable toolchain (still on Deno Deploy)

Lowest regret, and it works on both runtimes.

- `package.json` + `tsconfig.json` with the `#/` alias. JSR `@std/*` replaced
  by npm or platform APIs (`cookie`, `ulid`, `yaml`, `node:util` `parseArgs`,
  a tiny local semaphore).
- Unit tests on Vitest (`Deno.test` → `test`; keep `@std/assert` from npm at
  first, or codemod to `expect`).
- Oxlint + Oxfmt, with `lint-imports` ported as an Oxlint JS plugin (Biome 2 is
  the fallback if alpha plugins bite). `tsc --noEmit` on TypeScript 7.
- Scripts and Vite plugins on `node:` APIs. e2e on `@playwright/test`, keeping
  the blast-radius selector.
- Temporal through a polyfill wherever workerd or browsers lack it.
- CI on Node.

### 2. Runtime seams (still on Deno Deploy)

Take the Deno assumptions out of request paths, so that afterwards only the
store module and the entry point are Deno-specific.

- One env module instead of `Deno.env` reads, and an explicit app-environment
  flag instead of `isDev` = "not on Deploy".
- Puzzles, the manifest and `danish-names.json` bundled at build time. Future
  puzzles are no longer public static files.
- Solver without `new Worker`: in-request with the budget chosen by the spike,
  serialised per isolate as today.
- A tracing setup that exports on any host (spans keep their names). PostHog
  server events flushed through the platform's `waitUntil`.

### 3. SQL store, built alongside KV

- DO class with the schema: user, solution (one row, indexed by puzzle / path /
  user), score, user_score (ranked index), feedback, rating, auth tables. A
  small migration runner on `PRAGMA user_version`. Raw SQL with typed helpers,
  or Drizzle's durable-sqlite driver, chosen during the layer.
- `db/` functions reimplemented against it with the same signatures. The solve
  becomes one transaction.
- Transform script: hourly backup JSONL → SQL import (bots dropped, the four
  solution indexes deduped, scores rebuilt, `auth` sub→userId kept). Verified by
  solution, player and score-total counts.
- Merges unused in production.

### 4. Cutover to Workers

- `wrangler.jsonc`, Worker entry, static assets, secrets (same
  `COOKIE_SIGNING_KEY`, so every signed cookie stays valid), Cron Trigger
  backup, OTLP export.
- e2e workflow on Worker Previews instead of Deploy's `deployment_status`
  events. Previews may need Cloudflare Access or the e2e secret on writes.
- Runbook: a short read-only window → final backup → import → verify counts →
  point `skub.app` (already on Cloudflare DNS) at the Worker. Anonymous play
  keeps working throughout. Auth sessions may be dropped (one re-login).
- Check against the perf budgets: GET TTFB ≤ 150 ms warm from EU, solve POST
  ≤ 400 ms.
- Retire Deno Deploy, `db/kv.ts`, the KV Connect scripts and `deno.json`.

### 5. Replace Fresh

Fresh won't be maintained, so it gets replaced after the cutover. The
replacement is being chosen. Astro 6 (owned by Cloudflare, workerd in dev and
prod, Preact islands) is the current front-runner, at roughly 2.5–3× the move's
framework cost. Routes, middleware and Partials would be rewritten. Islands,
`game/`, `components/` and `lib/` carry over.

## Open decisions

- Fresh's replacement (layer 5).
- Toolchain wrapper: Vite+ (`vp`) on Node, or the same tools called directly;
  Bun only as installer/script runner.
- DO placement: `locationHint: "weur"` (best effort) or the `eu` jurisdiction
  (hard EU residency, permanent).
- Store tests: run the SQL layer against in-memory SQLite in unit tests, or
  keep store code out of unit tests as today.
