# Spike: offline service worker + ClientRouter + outbox

> Copied from `spike/offline-sw` (fix `c58846a1`, write-up `6dca462e`). The code
> stays on that branch.

- **Date:** 2026-11-25
- **Branch:** `spike/offline-sw` (throwaway), app in `spike-offline/`
- **Stack:** Astro 6.4 + `@astrojs/cloudflare` (`astro preview` runs workerd),
  Preact islands, `ClientRouter`, hand-written `src/sw.ts`, `idb-keyval`.
- **Harness:** `node e2e/run.mjs`: builds, serves on :4412, then headless
  Chromium (Playwright 1.65) with `context.setOffline`. 25 fake puzzles; 20 are
  "released".

## Results

All 13 checks pass in one run (`e2e/out/results.json`, gitignored).

| #     | Check                                                                      | Result | Evidence                                                                                                                                                                        |
| ----- | -------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| setup | SW controls the page; `/` + 20 released pages cached                       | pass   | 21 pages and 10 assets cached; p21–25 and `/solutions` not cached                                                                                                               |
| 1     | Offline ClientRouter nav between cached pages                              | pass   | p1 → p2 → / → p5: same document, 3 view transitions, 0 server requests                                                                                                          |
| 1b    | Offline full load of a cached page                                         | pass   | `/puzzles/p7` renders and hydrates                                                                                                                                              |
| 2     | Uncached page via ClientRouter: overlay, then continues online             | pass   | overlay after 68 ms (fetch failed); online → `/solutions` in the same document, overlay closed                                                                                  |
| 2b    | Hung navigation: overlay at ~3 s, closes when the page arrives             | pass   | opened 3008 ms, page 5313 ms                                                                                                                                                    |
| 2c    | Overlay → "Play offline" → offline Home                                    | pass   | `/?offline&return=%2Fsolutions`, 6 uncached links dimmed                                                                                                                        |
| 3     | Offline full load of an uncached page → offline Home; return dialog online | pass   | redirected to `/?offline&return=%2Fpuzzles%2Fp23`; no dialog offline, dialog with `/puzzles/p23` online                                                                         |
| 4     | Offline solve: 202, stays, syncs once                                      | pass   | 202 from SW, URL unchanged, second tab shows "1 solve will sync…", 0 server records offline → 1 after reconnect (trigger `online`), extra drain made no duplicate, outbox empty |
| 5a    | Lost response (server commits, then hangs past 5 s)                        | pass   | 202 after 5062 ms; replay hit the server twice (`attempts: 2`), 1 record                                                                                                        |
| 5b    | Connection reset after commit                                              | pass   | 202; replay deduped, 1 record                                                                                                                                                   |
| 6     | Old tab survives a deploy                                                  | pass   | v1 tab after the v2 build: server 404s the v1 solver chunk, SW serves it from cache, hint says "build v1"; ClientRouter into a v2 page then loads v2 chunks; one Preact module  |
| 7     | `Set-Cookie` on a replayed response is stored                              | pass   | the replay gets an opaque 303 (`redirect: "manual"`); the `progress=p4` HttpOnly cookie is in the jar                                                                           |

**`sw.ts`:** 214 lines of source; built `sw.js` is 6.1 KB minified, **2.6 KB
gz** (with `idb-keyval` and the shared action descriptors).

## What broke and the fix

Everything after 1b failed because the islands on an offline full load never
hydrated. Every `/_astro/*` request missed the asset cache. The preview server
(workerd assets) sends `Vary: Origin`. Install precaches with `cache.addAll()`
(no `Origin` header), but module scripts are CORS requests and send one, so
`cache.match(request)` misses. Fix: `cache.match(request, { ignoreVary: true })`
for assets. Check 1 hid it because a ClientRouter swap reuses modules that are
already loaded.

The first check 6 failure was a test race (it read the hint before the solver
chunk had loaded).

## Gotchas

### Service worker lifecycle and updates

- `skipWaiting()` + `clients.claim()`: the first visit becomes controlled
  without a reload. Without the claim, setup's first page wouldn't go through
  the SW until the next navigation.
- Install precaches **every** hashed asset of the build, not just the solver.
  Islands load their chunks lazily, so a cached page can't hydrate offline
  without them.
- Old builds' assets are kept by build id: every response carries `x-build`
  (middleware), install stores `build:<id>` → asset list in IDB, and activate
  prunes assets that neither the current build nor any cached page's `x-build`
  uses. The asset cache isn't versioned, so an old tab and a new worker share
  it.
- A ClientRouter swap isn't a navigation, so the browser never checks `sw.js` in
  a long-lived tab. `app.ts` calls `registration.update()` at most hourly on
  `astro:page-load`.
- Old tab after a deploy: once the new worker activates, ClientRouter swaps the
  old tab into a new-build page. The new page's chunks load next to the
  still-running old `app.ts` (inline module scripts run once per document). It
  worked here because Preact's chunk hash didn't change between builds. A Preact
  upgrade in a deploy would load a second Preact into an old tab. Worth a full
  reload when `x-build` changes (cheap: a ClientRouter `astro:before-swap`
  check).
- `fillReleased()` runs on activate (not awaited) and on every page's `hello`
  message; the `released.json` list is refetched at most daily.
- `navigator.storage.persist()` exists only in Window contexts. The page must
  call it, not the SW. The spike doesn't call it.

### ClientRouter

- The overlay hooks `astro:before-preparation` and swaps in a retrying loader.
  To reuse Astro's own loader with our response, it temporarily replaces
  `window.fetch`, which is fragile across Astro versions. In the build, own the
  loader (fetch + `DOMParser` into `event.newDocument`) or check this on every
  Astro bump.
- Form submits with `formData` skip the overlay hook; offline writes go through
  `submitForm()` anyway.
- A form posted before hydration is a navigate-mode POST. The SW passes it
  straight to the network: it can't answer 202 to a navigation, or the player
  would see a blank page.
- The overlay dialog is `transition:persist`, so it survives the swap. The
  network-first race (400 ms) runs inside the SW, so ClientRouter sees a normal
  200 either way.

### Writes

- The lost-response case costs the player the full 5 s timeout before "saved on
  this device". Acceptable, but it's the felt cost of hung tunnels.
- Replays use `redirect: "manual"`, so the 303 arrives as `opaqueredirect`
  (status 0). Clear on `response.type === "opaqueredirect"`, not on `ok`.
  Chromium still stores its `Set-Cookie` (check 7).
- `drain()` is single-flight (a shared promise), so the `online` message, the
  first successful page request and Background Sync can all fire without double
  replays. Idempotency by id is still needed (5a/5b).

### Safari (not testable here)

- No Background Sync: replay relies on the `online` relay and on drain on the
  next successful request. iOS fires `online` unreliably after backgrounding;
  drain on `visibilitychange` too.
- Is `Set-Cookie` from a SW-issued `fetch` with `redirect: "manual"` stored in
  WebKit? Unverified. Test it on a device in rollout step 1. Fallback: replay
  with `redirect: "follow"` and the server sets cookies on the 303's target.
- ITP may evict script-writable storage (Cache Storage + IDB, including a
  pending outbox) after 7 days without interaction, unless the app is installed
  to the Home Screen. `persist()` may not help.
- `navigator.connection` (Save-Data) doesn't exist; the precache trickle always
  runs.
- Same-document view transitions need Safari 18+. Older versions fall back to
  Astro's fallback animation.

## Changes for `architecture.md`

- Service worker: "~150 lines" → ~215 lines, ~2.6 KB gz.
- Precache: "`/` and the solver bundle" → `/` and **every hashed asset of the
  build** (lazy island chunks are needed for an offline full load).
- Assets: name the mechanism: an `x-build` response header on every page plus
  per-build asset lists in IDB; prune on activate. Match with `ignoreVary`.
- Replace "calls `navigator.storage.persist()` once filled" with: the page calls
  it after the SW reports the fill is done (`persist()` is Window-only).
- Add: the SW passes navigate-mode POSTs (pre-hydration form submits) to the
  network.
- Add: hourly `registration.update()` on `astro:page-load`; full reload on an
  `x-build` change during a ClientRouter swap (not built in the spike).
- Replay outcomes: "the write's 303" is an opaque redirect under
  `redirect: "manual"`; note the Safari cookie risk above and its fallback.
- Replay triggers: add `visibilitychange` for iOS.
- Nothing in decisions 32–36 changes.
