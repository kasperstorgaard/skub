# Spike: Astro on workerd, with a SQLite DO

Throwaway app in `spike-app/` (branch `spike/astro-workerd`), 2026-11-25. Checks
run in local dev (workerd via the Vite plugin) and in `astro preview` (the built
Worker in workerd). Browser checks: `spike-app/scripts/browser-check.mjs`.

## Versions

astro 7.4.13 · @astrojs/cloudflare 15.0.0-beta.6 · @astrojs/preact 6.1.6 ·
@cloudflare/vite-plugin 2.0.0-rc.6 · cf 1.0.0-rc.6 · @cloudflare/config
1.0.0-rc.5 · miniflare 5.20261123.1-beta · vite 8.3.8 · preact 10.29.8 ·
@preact/signals 2.11.4 · tailwindcss 4.3.5 · typescript 7.0.2 · bun 1.4.5 · node
22.23.5 · playwright 1.65.1.

**Astro 7, not 6.** Astro 7 has been out since June 2026. Astro 6 is on Vite 7,
and its adapter (v13) only supports Wrangler and vite-plugin v1. `cf` and
vite-plugin v2 need `@astrojs/cloudflare` 15 (beta), which needs Astro ≥ 7.4.
The docs' "Astro 6" should read "Astro 7".

## `cf` / vite-plugin v2 vs Wrangler

v2 works. With adapter 15 there's no Wrangler config at all: the adapter throws
if it finds a `wrangler.*` without a `cloudflare.config.ts`. A custom
entrypoint, a SQLite DO export with its binding, `nodejs_compat` and a secret
from `.dev.vars` are all set in `cloudflare.config.ts`. The build writes the
standard Build Output to `.cloudflare/output/v1`.

## Results

| Check                                                        | Result                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bunx --bun astro dev` / `astro build`                       | **Fail**                     | `@cloudflare/config` refuses Bun: "cloudflare.config.ts loading is not supported on Bun. Please use Node.js v22.18.0 or higher." (it needs `node:module` `registerHooks`). It affects dev and build alike.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Fallback: Node 22, Bun for installs                          | Pass                         | `bun install`, then `bunx astro dev` / `build` / `preview` (without `--bun`, so they run on Node 22).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Dev runs in workerd                                          | Pass                         | Errors come from `workerd/jsg`. `cloudflare:workers` imports and the DO RPC work in dev.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Shared parser, puzzles bundled at build time                 | Pass                         | `import.meta.glob('../../../static/puzzles/*.md', { query: '?raw', eager: true })` and `#/game/parser.ts`. Nothing is read from disk at runtime.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| One island root renders `islands/board.tsx`                  | Pass                         | `PuzzleRoot` (`client:load`) owns the signals and renders the shared `Board`, `Dialog` and `Router` unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Slot content stays server-rendered                           | Pass                         | The h1 and `DifficultyBadge` are inside `<astro-slot>`. A DOM marker on the h1 survives the island's re-renders. The badge's code isn't in any client chunk.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| One Preact instance                                          | Pass                         | Build: the Preact core is in 1 client chunk and 1 server chunk, and the hooks are in 1 chunk. Dev: one `.vite/deps/preact.js`. It needs `resolve.dedupe` and explicit `optimizeDeps.include` (see gotchas).                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Tailwind `@source` on shared dirs                            | Pass                         | Built CSS has classes found only in `islands/board.tsx` (`grid-rows-[repeat(8,…)]`), `islands/dialog.tsx` (`min-w-92`) and `components/difficulty-badge.tsx` (`cursor-help`). The repo's `styles.css` is imported as-is.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ClientRouter between two puzzle pages                        | Pass                         | No full reload (a window marker survives), the board takes moves after the swap, back works. It needed a shared-router fix (below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Moves use `replaceState`, no remount                         | Pass                         | The URL gets `moves=`, `history.length` doesn't change, and a DOM marker on `.board` survives.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `?dialog=` link beside ClientRouter                          | Pass                         | It opens in place and keeps the moves. Close removes the param.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Errors on back after cross-page moves                        | **Open**                     | `Invalid move: C4B4` is thrown once on back from a played Alf page to a played Ægir page. The page ends up correct. The likely cause: Astro never unmounts a Preact island on a swap, so the stale Alf island renders Ægir's moves.                                                                                                                                                                                                                                                                                                                                                                                                              |
| No-JS form POST → 303                                        | Pass                         | Playwright with JS off: `POST 303 /puzzles/aegir`, landing on `?saved=N`. It is handled in the page frontmatter with `Astro.request.formData()` and `Astro.redirect(url, 303)`. A ClientRouter form submit is opted out with `data-astro-reload`.                                                                                                                                                                                                                                                                                                                                                                                                |
| DO: `src/worker.ts` exports the class beside `handle()`      | Pass                         | `export class Store extends DurableObject` and `export default { fetch: handle }`, in dev and preview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| DO write in `transactionSync`, read back                     | Pass                         | `INSERT OR IGNORE` inside `transactionSync`. Replaying the same id is a no-op (the count stays 1). The `/puzzles/[slug]/solves` GET lists the rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `deleteAll()` behind a guarded reset                         | Pass                         | `POST /api/e2e/reset` answers 403 without `x-e2e-secret` and 204 with it. The table is empty afterwards. `deleteAll()` drops the tables too, so migrate runs again.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `PRAGMA user_version` for migrations                         | **Fail**                     | `SQLITE_AUTH` for both read and write in the DO (`PRAGMA table_list` and `foreign_keys` are allowed). The spike keeps the version in a `schema_version` table instead. architecture.md needs changing.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Solver in a lazy Web Worker                                  | Pass                         | `import('#/game/solver-worker.ts?worker')` on click. The worker chunks load only after the click. It solves Ægir in 9 moves (2.7 s including startup, headless).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `node:zlib` under `nodejs_compat`                            | Pass                         | `deflateRawSync`/`inflateRawSync` round-trip, and are byte-compatible both ways with `lib/deflate.ts`. Note: `lib/deflate.ts` actually uses `CompressionStream('deflate-raw')`, not `node:zlib`, and that also works in workerd, so the progress cookie may not need `nodejs_compat`.                                                                                                                                                                                                                                                                                                                                                            |
| `cf` 1.0.0-rc.6 + vite-plugin 2.0.0-rc.6 + config 1.0.0-rc.5 | Pass                         | Bumped to match the logged-in global `cf`. `cf deploy --dry-run` builds via Astro, and the plan lists only `STORE` (DO), `ASSETS` and `E2E_SECRET`: no KV or Images binding.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Deploy to `*.workers.dev`                                    | Pass                         | `cf deploy` builds via Astro and deploys `spike-astro-workerd` (Worker startup 22 ms, 10 asset files, only `ASSETS`, the DO and a text var as bindings: no KV or Images was provisioned). The first requests after deploy got TLS handshake errors for ~1 min, then 404s for ~1 min, before it served: new-Worker propagation. The puzzle page, the island (`<astro-island>` present), the no-JS form POST (303 to `?saved=N`) and the DO read/write all work on the deployed URL.                                                                                                                                                               |
| Per-branch preview, own DO storage                           | Pass, with a required change | `cf previews deploy --preview-name <name>` gives `https://<name>-<worker>.skub.workers.dev`. **With `bindings.durableObject({ worker: name, ... })` the previews shared the main Worker's DO**: a write through preview A showed on main and B, and the reset on A wiped main. The docs say this: a named `env` binding targets the deployed namespace. **Fix: reach the DO through `ctx.exports`** (`import { exports } from "cloudflare:workers"; exports.Store`) and drop the binding. Then a write on main and one on preview A stayed separate, B saw neither, and reset on A emptied A only. `locationHint: "weur"` works on previews too. |
| `deleteAll()` reset on a preview                             | Pass                         | `POST /api/e2e/reset`: 403 without `x-e2e-secret`, 204 with it; the preview's rows were gone, main's stayed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| DO round trip from Denmark (`weur`)                          | Pass                         | See the table below. The Worker ran at CPH, the DO at AMS (`/cdn-cgi/trace` from inside the DO). `cf-ray` suffix CPH.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Cleanup                                                      | Pass                         | See the list below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Round trips (deployed, from Denmark, edge CPH, DO in AMS)

TTFB in ms (`curl time_starttransfer`). Warm = 30 samples on one kept-alive
connection (first request excluded). Fresh = 25 samples, a new TCP+TLS
connection each.

| Measure                        | warm p50 | warm p95 | fresh-conn p50 | fresh-conn p95 | Budget |
| ------------------------------ | -------- | -------- | -------------- | -------------- | ------ |
| (c) GET, no DO call (baseline) | 16-19    | 35-43    | 38             | 58             | n/a    |
| (a) GET + 1 DO read            | 40-41    | 66-67    | 59             | 73             | <= 150 |
| (b) POST + 1 DO write, 303     | 37-38    | 53-61    | 68             | 86             | <= 400 |

(Warm ranges are two runs of 30.) The DO adds about 22-25 ms over the baseline.
Cold: the first requests right after a deploy took 70-336 ms (336 ms for the
first DO read, which includes starting the DO); the first request after 150 s
idle took 104 ms (DO read) then 79 ms. Worker-to-DO RPC measured inside the
Worker: ~28-34 ms per `ping()` (one sample each).

**Cleanup list.** Created: Worker `spike-astro-workerd` (+ its DO namespace
`Store` and storage), previews `spike-a` and `spike-b`. Deleted with
`cf previews delete spike-a|spike-b --worker spike-astro-workerd --force` and
`cf workers delete spike-astro-workerd --force` (deleting the Worker deletes its
DO namespaces). Verified: `cf workers list` returns `[]`, and the three
workers.dev URLs return 404. No secrets, KV, routes, DNS or domains were
touched. The workers.dev subdomain was registered by the owner beforehand and
left as is.

## Numbers (production build)

| Measure                                     | Value                                                                                             | Budget                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------- |
| JS gz, puzzle page (without the solver)     | **25.1 KB** (5 chunks: island 9.9, Preact 5.2, ClientRouter 5.7, signals + hooks 4.1, client 0.8) | ≤ 40 KB                         |
| Solver chunks (lazy)                        | 2.8 KB gz                                                                                         | excluded                        |
| CSS gz                                      | **14.5 KB**                                                                                       | ≤ 16 KB                         |
| SSR render, warm, `astro preview` (workerd) | 2–4 ms (7 samples; the first was 11 ms), local TTFB ~8 ms                                         | ~20 ms                          |
| Worker → DO RPC, local                      | 0–2 ms                                                                                            | ~28-34 ms deployed (CPH to AMS) |

The render time comes from a middleware that buffers the body and reports
`Server-Timing`. Local workerd rounds timers to whole milliseconds.

## Shared code changes

- `islands/router.tsx` (three small edits, on this branch only):
  1. `replaceState`/`pushState` keep `history.state`. Writing `{}` wiped
     ClientRouter's index.
  2. The click handler listens on `document` in capture, so ClientRouter sees
     `defaultPrevented`. Otherwise ClientRouter claims every `data-router` link
     first: a move became a full page swap and remounted the board.
  3. `useRouter` ignores locations on another pathname, since ClientRouter swaps
     those.
- Nothing else. `islands/board.tsx`, `dialog.tsx` and `difficulty-badge.tsx`
  render unchanged. `game/parser.ts` imports `@std/front-matter` through
  `npm:@jsr/std__front-matter` (bunfig `@jsr` scope).

## Gotchas

- **Astro backgrounds `astro dev` when it detects an agent** (`CLAUDECODE=1`):
  it detaches, writes `.astro/dev.log` and needs `astro dev stop`. The log dumps
  the whole environment, tokens included. `.astro/` must stay gitignored.
- **Shared JSX outside the app:** no tsconfig covers `../islands`, so Vite's dep
  scanner assumed React's JSX runtime (`react/jsx-dev-runtime`). The fix is
  `oxc.jsx` plus `optimizeDeps.rolldownOptions.transform.jsx`, set on both the
  client and the `ssr` environment. The adapter doesn't forward a top-level
  transform to `ssr`.
- **Duplicate Preact in dev** (`reading '__H'`) when deps are discovered in the
  middle of a request. Listing the Preact entries (including `preact/debug` and
  `preact/devtools`) in `optimizeDeps.include` fixes it. `resolve.dedupe` makes
  the shared files' bare imports resolve from `spike-app/node_modules`.
- **The adapter auto-adds `SESSION` (KV) and `IMAGES` bindings,** which deploy
  would provision. Turn them off with `session: false` and
  `imageService: "passthrough"`.
- **ClientRouter swaps `<html>` attributes,** which drops `data-js`. Set it
  again on `astro:after-swap`.
- Dev and preview share local DO state (`.cloudflare/state`).

## Recommendation

Go with Astro 7 + `@astrojs/cloudflare` 15 + `cf`/vite-plugin v2. Everything
works in workerd and on a real deploy, and comes in well under budget (deployed
GET+DO read p50 ~40 ms, POST p50 ~38 ms from Denmark). Four changes to the plan:

1. Astro 6 → Astro 7 in the docs.
2. Run the Astro/Vite commands on Node 22 and keep Bun for installs, scripts and
   tests. This is the documented fallback, and it's forced, not optional, while
   `@cloudflare/config` rejects Bun.
3. Keep migrations in a version table, not `PRAGMA user_version`.
4. Access the DO via `ctx.exports`, not `bindings.durableObject({ worker })`.

Before the build:

- Fix the stale-island render: unmount Preact roots on `astro:before-swap`, or
  check the island's page in `useRouter`.
- Land the `islands/router.tsx` changes in step 1.
- Reach the DO through `ctx.exports` (`exports.Store`), not an `env` binding, or
  previews share production's storage. The CI e2e reset then only wipes the
  preview.
- Previews and the deploy need no secrets: the reset guard can be a per-preview
  text var or a secret set per preview; the spike used a text var.
