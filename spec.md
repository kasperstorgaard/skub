# Client JS budget

Target: home ≤ 25 KB and puzzle page ≤ 40 KB of gzipped JS on the critical
path. Today they are 78.2 KB and 95.5 KB.

## Problem

Measured from the production build: the server handler is called in-process
for `/` and `/puzzles/yrsa` (first visit, no cookies), every script the HTML
loads is followed through its static imports in `_fresh/client`, and each file
is gzipped (level 9). Dynamic imports are listed separately, not counted.

| Chunk                                          | gz      | Pages        |
| ---------------------------------------------- | ------- | ------------ |
| `fresh-island__tracking_script` (posthog-js)   | 57.5 KB | all          |
| `client-entry` (Fresh runtime)                 | 9.4 KB  | all          |
| `preact` + `hooks` + `signals` + `jsxRuntime`  | 9.2 KB  | all          |
| `cookie_banner` island                         | 0.8 KB  | all, until a cookie choice |
| `router`, `share_button`, `icons`              | 1.3 KB  | all          |
| board island + puzzle islands + shared libs    | 17.4 KB | puzzle       |
| `zingtouch` (dynamic, touch devices only)      | 6.6 KB  | puzzle, after hydration |

posthog-js is three quarters of the home page's JS and hydrates as an island,
so it sits on the critical path of every page's boot. Without it both pages
are already inside budget.

## What this branch does

**Cookie banner is a component.** It never had client code: it is a form that
POSTs to `/api/consent`. It now renders from `components/`, same markup, one
less island chunk and hydration. Works without JS as before.

| Page            | Before  | After   |
| --------------- | ------- | ------- |
| `/`             | 78.2 KB | 77.3 KB |
| `/puzzles/yrsa` | 95.5 KB | 94.7 KB |

The rest of the gap is PostHog, which waits on a decision (below).

**The PostHog proxy strips `content-encoding`.** Deno Deploy's `fetch`
decodes upstream bodies but keeps the header, so every response PostHog
compresses (`config.js`, `/flags/`) failed in the browser with
`ERR_CONTENT_DECODING_FAILED`: remote config and flags never loaded. Events
were unaffected. Option A below loads `array.js` through the same proxy.

## PostHog options (decision needed)

Nothing here is implemented. Baseline is after the cookie banner change.
"Critical path" is what the page boots with; "later" is fetched after boot.

What arrives from the browser today (PostHog, last 30 days): `$autocapture`
10.9k, `$pageview` 1.2k (20 people), `$web_vitals` 1.1k, `$pageleave` 679,
`$rageclick` 440, `$opt_in` 7. Session recordings: 0 in the last 30 days, so
replay is effectively off already. Everything else (`puzzle_solved`,
`hint_requested`, `cookie_consent`, …) is server-side and unaffected by any
option.

| Option | `/` crit. path | Puzzle crit. path | Later | Lost or delayed | Risk |
| ------ | -------------- | ----------------- | ----- | --------------- | ---- |
| Today | 77.3 KB | 94.7 KB | recorder/surveys if enabled remotely | — | — |
| **D. Same posthog-js, `import()` inside the island's effect** (measured) | **20.9 KB** | **37.8 KB** | 57.3 KB, hashed same-origin asset, immutable cache | Nothing dropped. Init happens ~one round trip after hydration: autocapture misses clicks in that window; initial `$pageview` and `$web_vitals` (buffered observers) still arrive | Low: 5-line change, version still pinned by the lockfile |
| A. Official snippet, `array.js` via `/ph/static` with `defer` (per spec) | ~20.5 KB + ~1 KB inline snippet | ~37.4 KB + ~1 KB | 57.3 KB `array.js` through the proxy, cached per PostHog's headers (spec says 4 h) | Same as D | Medium: version floats with PostHog's CDN, every cache miss is a proxied request through our isolate, island replaced by inline script |
| B. `posthog-js-lite` 4.13.0 in the island (bundled: 23.8 KB, not the ~6 KB the original spec assumed) | ~44 KB | ~61 KB | — | Autocapture, rageclicks, web vitals, replay, surveys, `$pageleave` | Misses the budget; drops web vitals the perf roadmap relies on |
| B′. `posthog-js/slim`, no extensions (dist bundle 32.6 KB; adding Analytics extensions duplicates core → 62.7 KB) | ~53 KB | ~70 KB | — | Autocapture, web vitals, history pageviews, replay | Misses the budget |
| C. No client PostHog; `$pageview` from `middleware/tracking.ts` | ~20.5 KB | ~37.4 KB | — | Web vitals, autocapture, rageclicks, `$pageleave`, session duration and bounce rate in web analytics; bots must be filtered server-side | Loses the one client signal the perf roadmap uses |

`~` values are "today minus the tracking island" computed from the measured
chunks, not a separate build.

**Recommendation: D.** It meets both budgets, keeps every event that arrives
today, needs no product decision, and serves posthog-js as an immutable
same-origin asset instead of a proxied 4-hour one. A is the same trade with
more moving parts. Revisit C only after the perf roadmap no longer needs web
vitals.

## Non-goals

- Replacing zingtouch: its own branch, `perf/pointer-gestures`. It costs
  6.6 KB gz on the puzzle page, touch devices only, loaded after hydration (0 on
  home, not on the critical path).
- Removing Preact or Fresh's client runtime. That is the architecture.
- The router island: 0.4 KB and every island depends on its event.
- Dropping web vitals while the roadmap is in progress.
