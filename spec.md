# Puzzles page: infinite card carousel

## Problem

`/puzzles` is a month strip, a calendar grid and one big selected-day card. You
browse by picking a day and then looking at a single card, which is slow to scan
and doesn't feel like a stream of puzzles.

## Approach

On mobile, one horizontal row of puzzle cards in calendar order, oldest on
the left and today on the right. Large cards (`PuzzleCard size="lg"`, number
only as the lead-in) snap (mandatory) to the centre, with 0.2 of a card showing on each
side, so the row overflows both ways on any screen. Cards are capped
at 24rem. The row runs full width and scrolls inside its own container
(`grid-flow-col`, `auto-cols-*`, `overflow-x-auto`, `snap-x`), with the
scrollbar hidden. Desktop keeps a calendar (see
"Heading and desktop").

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
- The month label above the row is the month of `?date`. 

### With JS

- **Two full-size sentinels around one loaded block.** One sentinel sits at
  each end of the row and is the `IntersectionObserver` target (root = the
  scroller, `rootMargin` about 2 weeks of card width). The server sets `--span`
  on each to the number of days it stands in for (from the manifest). Under
  `js:` the sentinel takes `grid-column: span var(--span)`, so it is exactly as
  wide as those cards, gaps included, and the scroll width is fixed from the
  first paint. Without JS it is a one-column prev/next link.
- **They look like skeleton cards.** The span is painted with a tiled SVG: a
  rounded-square outline for the thumbnail and two short bars for the caption.
  The SVG is applied as a `mask-image` over a token `background-color`
  (`surface-3`), so it follows the theme without one data URI per colour.
  `mask-size` is one column plus one gap, using the same CSS variables as
  the grid, so each outline lines up with where its card will land. It's
  one element, not one per day. It covers at most 300vw next to the loaded
  cards and tiles from that side: a mask as wide as the whole span (tens of
  thousands of pixels) is past the GPU's texture limit and draws nothing.
- **Growing the edge.** When a sentinel nears view, the island inserts the
  fetched cards next to it and lowers its span by the number of inserted
  `[data-date]` items. Count them rather than assuming 21, because a batch is
  short at today or at the first puzzle.
- **Scrolling only grows the edges.** Snapping is mandatory, so a fling
  always ends on a loaded card and never lands in a sentinel. Proximity
  snapping, and loading wherever a fling landed, made touch scrolling
  inconsistent: the block could be swapped while momentum was still running.
- **Batches wait for the scroll to settle.** Inserting cards mid-fling cut
  momentum short on touch, so the same flick threw different distances. A
  fetched batch is held until scrolling has been idle for 150ms, while the
  skeletons cover the gap. Layout metrics are cached per size rather than
  read on every scroll frame.
- **Month links replace the block.** A jump to a day that isn't loaded fetches
  around it, then swaps out the whole block and scrolls to the day in the
  same task. The old cards collapse back into the two spans and both spans
  are reset, so the total width is unchanged. There are always exactly two
  sentinels and one block.
- **Jump-free swaps.** Parse the fragment off-DOM into a `<template>` first.
  Then insert or replace the cards and set the spans in one synchronous block,
  with no `await` and no layout reads in between. Columns have a fixed track
  width and the thumbnails are inline SVG with `aspect-square`, so nothing
  resizes after a swap.
- **Prefetch deep for fast flicks.** The island keeps 3 weeks (21 days)
  loaded on each side of the centred day. On mount, that loads both
  directions when linked into a past week, and only older weeks on the
  current one. Each fetch is `GET /api/puzzles/days?from=<slot>&to=<slot>`
  for 21 days, capped at 42 days per request. Each side has at most one fetch
  in flight. A far jump drops any batches still in flight for the block it
  replaces.
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

### Heading and desktop

- The page title is the centred or selected **date** (`h1`, "November 9"),
  with the year as the lead-in above it. On mobile with JS, the island updates them as the
  row scrolls. "Puzzles" as a title is gone.
- Below the title, **month links** name their months ("‹ October", "December
  ›"). They're `.btn` with a new `data-variant="quiet"`: a neutral ring, no
  pearl or purple fill, lifting to `surface-2` on hover. Without JS they go to `?date=<month>-01`. On mobile with JS they scroll
  the row to that month's first day, which loads that block in place.
- **Desktop is a day details page by design**, hence the date as title.
  Mobile uses the same title, as a trial.
- **Desktop keeps the calendar.** The calendar grid from before, renamed
  `DesktopCalendar`, with fixed-height day cells, beside the selected day's
  card. The month pills are replaced by the heading's prev/next month links.
  The scroller is mobile only; the island attaches only below `lg`.

### Cards

On mobile only the centred card gets the purple `link` frame. The rest are
`surface-3`, so a row of them isn't a wall of purple. The island moves a
`data-centred` attribute as the row scrolls; it changes colour only, never
layout. Without JS every frame stays purple.

Each card reuses `PuzzleCard` at a smaller size. The tagline is the short
weekday and date (e.g. "Mon 9") plus the puzzle number. A day without a puzzle
renders a muted placeholder of the same size, so the grid rhythm holds.

### Removed

The total-puzzles `Panel`. On mobile, `CalendarGrid` and the selected-day
card; desktop keeps them (see above).
`MonthStrip` is removed on both. A minimap month strip was tried and dropped: too
much going on.

## Tests

- Unit: a pure week helper in `game/date.ts` (week bounds for a date, clamped
  to today, with prev/next week dates). Cover a week that spans a month
  boundary, a week that spans a year boundary, and the current partial week.
- e2e: rewrite `archives_test.ts` around the carousel. Clicking a card lands on
  the puzzle, and the prev link (no JS) shows the previous week.

## Non-goals

- Filtering, search, or difficulty grouping.
- Unloading cards while you scroll continuously. Far jumps drop the old block
  anyway; a long continuous scroll keeps everything it has loaded.
