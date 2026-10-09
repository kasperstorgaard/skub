# Client JS budget

Brings the home page to ≤ 25 KB and the puzzle page to ≤ 40 KB of gzipped JS.
Today they are about 77 KB and 95 KB.

## Problem

Measured from the production build (`_fresh/client`), gzipped:

| Chunk                                   | gz      | On every page |
| --------------------------------------- | ------- | ------------- |
| `fresh-island__tracking_script` (posthog-js) | 58.7 KB | yes      |
| `client-entry` (Fresh runtime)          | 5.6 KB  | yes           |
| `preact.module` + `hooks` + `signals`   | 9.0 KB  | yes           |
| `router`, `cookie_banner`, `share_button` | ~3 KB | yes           |
| `fresh-island__board` + `board`/`url`/`strings` libs | ~12 KB | puzzle |
| `controls_panel`, `hint_dialog`, `solution_dialog`, `celebration_dialog`, `auto_post` | ~9 KB | puzzle |
| `zingtouch` (dynamic, touch devices)    | 6.8 KB  | puzzle, touch |

posthog-js alone is three quarters of the home page's JS, and it hydrates as
an island, so it sits on the critical path of every page's boot. From the July
Lighthouse run it then lazy-loads the session recorder (~73 KB) and surveys
(~44 KB). Server-side events (`puzzle_solved`, `hint_requested`, …) do not
need it at all; what it provides is pageviews, web vitals and replay.

`islands/cookie-banner.tsx` ships as an island but has no client code: it is a
form that POSTs. `zingtouch` is a general gesture library used for one swipe
direction and a tap passthrough.

## Approach

**PostHog: pick one of three, with the impact spelled out.**

| Option | JS on `/` | Keeps | Loses |
| ------ | --------- | ----- | ----- |
| A. Load the official snippet (`/ph/static/array.js`) with `defer` after the page's own boot, not as an island | ~18 KB on the critical path; posthog-js arrives later and is browser-cached for 4 h | everything | nothing, but the bytes still transfer once per 4 h |
| B. `posthog-js-lite` (~6 KB gz) in the island | ~24 KB | pageviews, custom events, identify | web vitals, replay, surveys, autocapture |
| C. No client PostHog; capture pageviews server-side from `middleware/tracking.ts`, filter by `$virt_is_bot` in PostHog | ~18 KB | pageviews, server events | web vitals, replay, surveys |

Recommendation: **A** first, because it needs no product decision, then
revisit replay. Replay is the bulk of the lazy load and it has been always-on
for 20 visitors a month; turning it to a sampled or flag-gated recording in
the PostHog project cuts the lazy ~73 KB without a code change. Web vitals
are the one client-side signal the perf roadmap itself depends on, so C only
after the roadmap is done.

**Cookie banner becomes a component.** Move `islands/cookie-banner.tsx` to
`components/`. Same markup, one less hydration and one less chunk.

**Replace zingtouch with pointer events.** `client/touch.ts` needs: on
`pointerdown`, find the nearest piece; on `pointerup`, if the pointer moved
more than a threshold within a time window, derive the cardinal direction from
the dominant axis and call `onSwipe` with distance/time as velocity; otherwise
forward the tap. That is forty lines, no library, and it drops the dynamic
import and the `window.ZingTouch` global. Keep `calculateMoveSpeed` as is.

**Router stays.** It is 1 KB and every island depends on its event. Not worth
touching.

## Tests

- `client/touch.ts` gesture math (`angleToDirection` replaced by an axis
  function, `findNearestPiece`) is pure: test the direction thresholds and the
  nearest-piece radius in `client/touch_test.ts`. The hook wiring is not
  tested per `/testing`.
- Cookie banner: `new-user-flow_test.ts` already clicks through it; keep green.
- PostHog option A: verify in the browser that `$pageview` and `$web_vitals`
  still arrive (PostHog live events), and that no console errors appear with
  JS disabled.

## Acceptance

Puzzle page JS ≤ 40 KB gz on the critical path, home ≤ 25 KB, measured from
the build manifest sizes of the chunks the page's inline boot script imports.
Swipe on a touch device moves the puck in all four directions; tap on a piece
still selects it.

## Non-goals

- Removing Preact or Fresh's client runtime. That is the architecture.
- Dropping web vitals while the roadmap is in progress.
