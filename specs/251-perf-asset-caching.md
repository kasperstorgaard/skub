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

**Already done by the Fresh 2.3 upgrade (#249).** Every hashed `/assets/*`
file (CSS, island and runtime JS, shared chunks) is flagged immutable in
Fresh's build snapshot and served `public, max-age=31536000, immutable`. The
planned fallback cache middleware for `/assets/` is not needed and was not
added.

**Fonts as Vite assets.** Tailwind/Vite does not rewrite absolute `url()`s
that point into `static/`, and a preload through `asset()` would add
`?__frsh_c=` that the `@font-face` URL lacks, so the browser would fetch each
font twice. Instead the fonts live next to the stylesheet and are referenced
relatively, so Vite content-hashes them into `/assets/`. The two preloads in
`_app.tsx` import the same files with `?url` and resolve to the same hashed
URLs, which Fresh serves immutable.

**Favicons through `asset()`.** The two SVG favicons get the build-id cache
key and are served immutable. `/favicon.ico` stays as is: browsers only fall
back to it when no icon link is present, and its URL cannot carry a key.

**Preload the shared chunks.** Fresh exposes no hook to extend its `Link`
header, so a small Vite plugin records the chunks the client entry imports
(`preact.module`, `hooks.module`, `signals.module`) during the client build
and fills a server-side module with them; `_app.tsx` renders a
`<link rel="modulepreload">` per chunk. In dev the list is empty. A build that
records no chunks fails, so a change in Fresh's build order or entry name
surfaces instead of silently dropping the preloads; the plugin notes to
re-check on every Fresh upgrade whether Fresh preloads imports itself.

HTML responses are unchanged: no `Cache-Control`, since they carry per-user
cookies and content.

## Tests

Header behaviour is framework plumbing; verified by calling the built
server's handler in-process:

| Asset                       | Before             | After             |
| --------------------------- | ------------------ | ----------------- |
| Fonts                       | no-cache, no-store | immutable, 1 year |
| `/assets/*` (JS, CSS)       | immutable, 1 year  | immutable, 1 year |
| SVG favicons                | no-cache, no-store | immutable, 1 year |
| `/favicon.ico`              | no-cache, no-store | no-cache, no-store |
| HTML pages                  | none               | none              |

## Acceptance

Every `/assets/*` response and both fonts return `immutable`. A repeat visit
to `/puzzles/:slug` in a browser with cache transfers only the HTML.
Lighthouse mobile "Serve static assets with an efficient cache policy" passes.

## Non-goals

- Reducing the payload. That is `perf/client-budget` and `perf/css-diet`.
- Service workers or offline support.
