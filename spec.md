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
- The month label above the row is the month of `?date`.

### With JS

- **The prev/next links are the sentinels.** One island observes them with an
  `IntersectionObserver` whose root is the scroller, with a horizontal
  `rootMargin` of about one viewport. When a link nears view, the island
  fetches `GET /api/puzzles/weeks?date=…` and replaces the link with the
  response. That response contains those weeks' cards plus its own prev/next
  link, so loading keeps going in both directions.
- **Prefetch deep for fast flicks.** On mount, the island immediately loads 3
  weeks in each direction that has a sentinel: both, when linked into a past week; older only on the current week. After that, each fetch takes
  `&weeks=3` (one round trip, ~21 cards). The sentinel's `rootMargin` is about
  2 weeks of card width, so the next batch has landed before the buffer runs
  out. Only one fetch per direction is in flight at a time: a sentinel that
  intersects again while its fetch is pending is ignored.
- The API returns an **HTML fragment**: the same `WeekCards` component rendered
  with `preact-render-to-string`. Thumbnail SVG and the card stay
  server-only, with no JSON-to-card duplication on the client. It reads only
  the score cookie, so a GET makes no KV calls.
- When an older week is prepended, the island adds the inserted width to
  `scrollLeft` so the view doesn't jump.
- The same island renders the **month label**. It tracks the leftmost card that
  is fully in view (`data-date` on each card) and updates the month as you
  scroll. It also does `replaceState(?date=…)` so a reload or back navigation
  returns to the same place. It doesn't set `aria-live`, because the label
  would chatter on every scroll.
- The row itself is a static component. The island attaches to it by id and
  never owns that DOM, so Preact's vdom and the injected HTML don't conflict.

### Cards

Each card reuses `PuzzleCard` at a smaller size. The tagline is the short
weekday and date (e.g. "Mon 9") plus the puzzle number. A day without a puzzle
renders a muted placeholder of the same size, so the grid rhythm holds.

### Removed

`CalendarGrid`, the selected-day card, and the total-puzzles `Panel`. The
`MonthStrip` is removed in this layer and comes back reworked in the next one
(below).

## Tests

- Unit: a pure week helper in `game/date.ts` (week bounds for a date, clamped
  to today, with prev/next week dates). Cover a week that spans a month
  boundary, a week that spans a year boundary, and the current partial week.
- e2e: rewrite `archives_test.ts` around the carousel. Clicking a card lands on
  the puzzle, and the prev link (no JS) shows the previous week.

## Non-goals

- Month navigation. A month strip that moves with the scroll and jumps to a
  month on click is the **next stacked PR**.
- Filtering, search, or difficulty grouping.
- Virtualising or unloading weeks that have scrolled far out of view.
