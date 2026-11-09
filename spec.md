# Puzzles page: infinite card carousel

## Problem

`/puzzles` is a month strip, a calendar grid and one big selected-day card. You
browse by picking a day and then looking at a single card, which is slow to scan
and doesn't feel like a stream of puzzles.

## Approach

One horizontal row of puzzle cards in calendar order, oldest on the left and
today on the right. Mobile first: about 3 cards in view, with roughly 10% of the
next card peeking in so it's clear the row scrolls. Desktop shows 5–7. The
row is wider than the content column and scrolls inside its own container
(`grid-flow-col`, `auto-cols-*`, `overflow-x-auto`, `snap-x`).

**Page unit = one ISO week (Mon–Sun).** `?date=YYYY-MM-DD` picks the week that
contains that date and defaults to today. The current week stops at today
(future days only show in dev, as now).

### Without JS

- The server renders the week for `?date`, with a `prev` link at the start of
  the row and a `next` link at the end. Both are grid items inside the scroller
  and point to `?date=<other week>#<day>`. There is no `next` link on the
  current week.
- The fragment scrolls the target card into view. On a plain `/puzzles` landing
  the card for today gets `scroll-initial-target` where the browser supports it.
- The month label above the row is the month of `?date`. The minimap (below)
  renders at that position, and its months are links to `?date=<month>-01`.

### With JS

- **A skeleton card for every day.** The server renders one light skeleton
  per day outside the current week: an empty outline the size of a card,
  carrying `data-date`. The full row exists from the first paint, so the scroll
  width is fixed and the minimap has a real element to scroll to. Skeletons are
  `noscript:hidden`, and hidden grid items take no column, so the no-JS page is
  still just the week. The prev/next links are `js:hidden`.
- **Skeletons are the sentinels.** The island observes them with an
  `IntersectionObserver` whose root is the scroller and whose `rootMargin` is
  about 2 weeks of card width. When a skeleton comes near view, the island
  loads its week. A week loads wherever it is: at the edge of loaded cards, or
  deep in the row after a hard flick or a minimap jump. There's no gap
  splitting and no span math.
- **Swap 1:1, no shifting.** Each fetched card replaces the skeleton with the
  same `data-date`, same column, same width. Nothing changes size, so no
  scroll correction is ever needed. Rules that keep it jump-free:
  - **Synchronous swap.** Parse the fragment off-DOM into a `<template>`
    first. Then replace the skeletons in one synchronous block, with no
    `await` and no layout reads in between.
  - **Fixed card size.** Columns have a fixed track width and the thumbnails
    are inline SVG with `aspect-square`, so nothing resizes after the swap.
- **Prefetch deep for fast flicks.** On mount, the island loads 3 weeks either
  side of the rendered week, using `GET /api/puzzles/weeks?date=…&weeks=3`
  (one round trip, about 21 cards). After that, intersecting skeletons are
  batched into weeks. A week that is already in flight is never requested
  twice.
- **Budget.** About 365 skeletons per year of puzzles, each an empty element.
  That is cheap for both the DOM and the observer. Grid caps implicit tracks
  at around 1000 in Chromium, about 2.7 years, which is enough for now and
  noted for later.
- The API returns an **HTML fragment**: the same `WeekCards` component rendered
  with `preact-render-to-string`. Thumbnail SVG and the card stay server-only,
  with no JSON-to-card duplication on the client. It reads only the score
  cookie, so a GET makes no KV calls.
- The same island renders the **month label**. It tracks the leftmost card that
  is fully in view (`data-date` on each card) and updates the month as you
  scroll. It also does `replaceState(?date=…)` so a reload or back navigation
  returns to the same place. It doesn't set `aria-live`, because the label
  would chatter on every scroll.
- The row itself is a static component. The island attaches to it by id and
  never owns that DOM, so Preact's vdom and the injected HTML don't conflict.

### Minimap (month strip)

A horizontal strip above the row: month labels with a tick per day,
proportional to the whole row, under a fixed arrow-like indicator in the
middle. Its ends fade out with a `mask-image` gradient. It is a scaled-down
mirror of the scroller, and the part currently in view sits under the
indicator.

- **Following the scroll:** a CSS scroll-driven animation. The scroller sets
  `scroll-timeline: --row x`, a shared ancestor sets `timeline-scope: --row`,
  and the strip animates `translate` on that timeline. That's compositor-only
  with no JS per frame. Where scroll timelines aren't supported (Firefox), the
  island sets the same value as a CSS variable from a rAF-throttled scroll
  listener.
- **Clicking:** a click anywhere on the strip maps its x position to a day and
  scrolls the row there, so the day you clicked ends up under the indicator. A
  jump of up to about 2 weeks scrolls smoothly; longer jumps are instant, so
  you don't watch months of placeholder outlines slide by. The threshold is
  one constant, tuned once we see it in practice. The skeletons at the landing
  spot load as usual.
- **Without JS:** the server places the strip for `?date`, and each month
  label is a plain link.
- **Accessibility:** the month labels are the focusable links. Clicking
  between labels is a pointer convenience on top.
- The month label island from "With JS" sits in the strip's indicator.

### Cards

Each card reuses `PuzzleCard` at a smaller size. The tagline is the short
weekday and date (e.g. "Mon 9") plus the puzzle number. A day without a puzzle
renders a muted placeholder of the same size, so the grid rhythm holds.

### Removed

`CalendarGrid`, the selected-day card, and the total-puzzles `Panel`.
`MonthStrip` is replaced by the minimap.

## Tests

- Unit: a pure week helper in `game/date.ts` (week bounds for a date, clamped
  to today, with prev/next week dates). Cover a week that spans a month
  boundary, a week that spans a year boundary, and the current partial week.
- e2e: rewrite `archives_test.ts` around the carousel. Clicking a card lands on
  the puzzle, and the prev link (no JS) shows the previous week.

## Non-goals

- Filtering, search, or difficulty grouping.
- Virtualising or unloading weeks that have scrolled far out of view.
