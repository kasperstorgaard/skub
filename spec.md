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

Bump `fresh` to `^2.3.3` and `@fresh/plugin-vite` to `^1.1.2`. The 2.3
changelog lists no breaking API changes; `Partial`, `define.handlers` and the
`fresh/runtime` / `fresh` imports work unchanged.

Behaviour changes checked against this app:

- Hashed `/assets/*` files are flagged `immutable` by the plugin, so island JS
  and the stylesheet are now served `public, max-age=31536000, immutable`.
  Unhashed `static/` files (fonts, favicons) stay `no-store`; that is
  `perf/asset-caching`'s job.
- `needsClientRuntime`: every page renders the `Router` and `TrackingScript`
  islands from `_app.tsx`, so every page still boots the client. No change.
- Forms inside `f-client-nav` without `f-partial` are no longer intercepted.
  The two `f-client-nav` regions (header, archive) contain no forms.
- Fresh now injects `<meta name="traceparent">` itself when an OTEL span is
  active. The app emitted the same tag from `_app.tsx`, which would have
  doubled it in production, so the app's copy is removed and the client keeps
  reading Fresh's tag by name.

The lockfile re-resolved some transitive `@std/*` versions. `@std/http` is
held at 1.0.25: 1.1 widens `getCookies` to `string | undefined` values and
breaks type checks, which is unrelated to the framework bump.

## Tests

CI (`deno fmt --check`, `deno lint`, `deno test -A` scoped to unit paths) must
pass unchanged. Kasper runs the e2e suite; ask him to run
`new-user-flow_test.ts` and `returning-user-flow_test.ts` against the preview
build, which exercise islands, partials and dialogs end to end.

## Acceptance

Headers on `/assets/*.js` in the production build show `immutable`. No change
to any page's rendered HTML other than Fresh's own boot script and the
traceparent tag now coming from Fresh.

## Non-goals

- Streaming SSR. 2.3 still calls `renderToString`; nothing to gain yet.
- Any app-level perf change. Those follow in their own PRs.
