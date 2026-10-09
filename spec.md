# Upgrade Fresh to 2.3

Framework bump, kept separate so its regression surface is reviewed on its
own. Prerequisite for `perf/asset-caching`.

## Problem

Fresh 2.2.2 serves every file from `static/` and every built island chunk
under `/assets/` with `Cache-Control: no-cache, no-store, max-age=0,
must-revalidate`, unless the URL carries the `?__frsh_c=<build id>` cache key.
Only the stylesheet gets that key. Verified on production: the CSS is
`immutable`, the island JS and the fonts are `no-store`. Every navigation
re-downloads around 95 KB of gzipped JS on a puzzle page, 59 KB of which is
the tracking island.

Fresh 2.3.3's `static_files.ts` adds `file.immutable`, which the Vite plugin
sets for hashed assets, and `needsClientRuntime`, which skips the client boot
on pages without islands.

## Approach

Bump `fresh` to `^2.3.3` and `@fresh/plugin-vite` to `^1.1.2`. Build, run
`deno task preview`, and curl the headers for an `/assets/*.js` chunk: expect
`public, max-age=31536000, immutable`. If the plugin does not flag them, say
so in the PR and let `perf/asset-caching` add the one-line middleware fallback.

Read the 2.3 changelog for breaking changes before touching code. Known
differences worth checking here: the `Partial` wrapper in `_app.tsx`, the
`define.handlers` typing, and the `fresh/runtime` exports the islands import.

## Tests

CI (`deno fmt --check`, `deno lint`, `deno test -A` scoped to unit paths) must
pass unchanged. Kasper runs the e2e suite; ask him to run
`new-user-flow_test.ts` and `returning-user-flow_test.ts` against the preview
build, which exercise islands, partials and dialogs end to end.

## Acceptance

Headers on `/assets/*.js` in preview show `immutable`. No change to any page's
rendered HTML other than Fresh's own boot script.

## Non-goals

- Streaming SSR. 2.3 still calls `renderToString`; nothing to gain yet.
- Any app-level perf change. Those follow in their own PRs.
