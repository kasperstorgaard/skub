# Cache every hashed asset and font

Follows `chore/fresh-2.3`. Makes the client payload a one-time cost per
deploy instead of a per-navigation cost.

## Problem

Measured on production 2026-10-09:

| Asset                           | Cache-Control          |
| ------------------------------- | ---------------------- |
| `/assets/client-entry-*.css?__frsh_c=…` | immutable, 1 year |
| `/assets/*.js` (islands, runtime)       | no-cache, no-store |
| `/fonts/chakra-petch-*.woff2`           | no-cache, no-store |
| `/favicon-*.svg`                        | no-cache, no-store |

The fonts are preloaded from `_app.tsx` with plain hrefs, so each page load
downloads them again and they block text rendering until they do. The JS
chunks are content-hashed in the filename and could be cached forever.

Fresh does send `Link: …; rel="modulepreload"` for the top-level island
entries, but not for the shared chunks they import (`preact.module`,
`hooks.module`, `signals.module`), so the browser discovers those a round trip
later.

## Approach

**Fonts and favicons through `asset()`.** `fresh/runtime` exports `asset(path)`
which appends the build-id cache key; Fresh then serves the file immutable.
Use it for the two preloaded fonts, the `@font-face` sources in `styles.css`
(Tailwind/Vite rewrites CSS `url()` to hashed assets at build; verify, and if
it does, the CSS side is already fine), and the favicons.

**Fallback cache middleware for `/assets/`.** If the 2.3 upgrade did not flag
hashed chunks immutable, add a middleware in `main.ts` ahead of `staticFiles()`
that sets `Cache-Control: public, max-age=31536000, immutable` on any
`/assets/` path. Filenames there are content-hashed by Vite, so this is safe.
Remove it once Fresh does it.

**Preload the shared chunks.** Read Fresh's build manifest (the same data it
uses for the `Link` header) and append the second-level imports of the page's
islands to the `Link` header. If Fresh exposes no hook for that, append
`<link rel="modulepreload">` tags in `_app.tsx` for the three shared runtime
chunks, resolved through the manifest at request time. Keep it to the shared
runtime; per-island chunks are already covered.

## Tests

Header behaviour is framework plumbing; verify with curl against
`deno task preview`, and record the before/after headers in the PR body.

## Acceptance

Every `/assets/*` response and both fonts return `immutable`. A repeat visit
to `/puzzles/:slug` in a browser with cache transfers only the HTML.
Lighthouse mobile "Serve static assets with an efficient cache policy" passes.

## Non-goals

- Reducing the payload. That is `perf/client-budget` and `perf/css-diet`.
- Service workers or offline support.
