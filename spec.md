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
| Framework | Fresh 2.3 | Being chosen (Astro 6 front-runner; Remix 3, own thin layer and a Fresh fork under review) |
| Static assets | `staticFiles()` | Workers Static Assets |
| Puzzles | `.md` files read from disk at runtime | Bundled at build time (generated module) |
| Cron | `Deno.cron` | Cron Trigger → backup to GCS (or R2) |
| Previews + e2e | Deploy previews sharing one KV | Worker Previews: one per branch, own DO storage |
| Tracing | Deploy's built-in OTEL | Workers OTLP export to an external backend |
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

### Non-goals

- Redesigning game rules or UI during the move. Ports first, then improvements.
- Redesigning data beyond what SQL makes natural (one solutions table, derived
  paths, a ranked score table).
- Migrating the ~1M bot `user` records. Only players with a solution or a login
  move.

## Plan

### Repo shape

- The new app lives in its own directory as a Bun workspace with its own
  `package.json` and `wrangler.jsonc`. The Deno app stays at the root until the
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

Each step is its own PR. Steps 1–5 touch only the new app and shared code, and
production doesn't change until step 6.

0. **Spikes (throwaway):**
   - The chosen framework on workerd under Bun with `@cloudflare/vite-plugin`:
     a page, an island, a partial navigation, a no-JS form POST and the
     streamed solve.
   - Solver memory and CPU. Workers caps memory at 128 MB per isolate. The
     editor budget (3M states) is about 175 MB today, and hints allow 7M states.
     The spike decides between three outcomes: it fits, it fits with a compact
     visited set (packed integer states in typed arrays), or the budget comes
     down.
   - A DO with `locationHint: "weur"` on a Worker Preview: the round trip from
     Denmark, and per-preview storage.
   - Bun with Vite 8, the Cloudflare plugin and Playwright. If Vite misbehaves
     on Bun, Vite runs on Node and Bun keeps everything else.
1. **Shared core.** Make `game/` and the portable parts of `lib/` import
   cleanly from Bun:
   - Bare specifiers and the `#/` alias, with JSR `@std/*` swapped for npm.
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
5. **Platform.**
   - Cron backup.
   - OTLP tracing.
   - PostHog via `waitUntil`, with the `/ph` proxy kept.
   - A staging Worker refreshed from the hourly backup, so the swap is
     rehearsed on real data.
6. **Swap.** This is the only step that touches production:
   1. A short read-only window.
   2. The final backup.
   3. Import, then verify the counts.
   4. Point `skub.app` at the Worker. It's on Cloudflare DNS already.

   The signing key is the same `COOKIE_SIGNING_KEY`, so every signed cookie
   stays valid. Auth sessions may be dropped, which means one re-login.
   Afterwards, check the perf budgets: GET TTFB ≤ 150 ms warm from EU, and solve
   POST ≤ 400 ms.
7. **Cleanup.**
   - Delete the Deno app, `deno.json`, the Deno CI and the KV Connect scripts.
   - Move the new app to the repo root if wanted.
   - Update CLAUDE.md and the skills.

## Open decisions

- The framework (scout running).
- DO placement: `locationHint: "weur"` (best effort), or the `eu` jurisdiction
  (hard EU residency, permanent).
- Store tests: run the SQL layer against in-memory SQLite in unit tests, or
  keep store code out of unit tests as today.
- How strictly to freeze features on the Deno app during the transition.
