# Puzzles page: infinite card carousel

## Problem

`/puzzles` is a month strip, a calendar grid and one big selected-day card. You
browse by picking a day and then looking at a single card, which is slow to scan
and doesn't feel like a stream of puzzles.

## Approach

On mobile, one horizontal row of puzzle cards in calendar order, oldest on
the left and today on the right. Large cards (`PuzzleCard size="lg"`, number
only as the lead-in) snap to the centre, with 0.2 of a card showing on each
side, so the row overflows both ways on any screen. Cards are capped
at 24rem. The row runs full width and scrolls inside its own container
(`grid-flow-col`, `auto-cols-*`, `overflow-x-auto`, `snap-x`), with the
scrollbar hidden. Desktop keeps a calendar (see
"Heading and desktop").

**Every day is in the row from the first paint.** The server renders a card
for each day in the archive, so the scroll width is fixed and never changes
while you scroll. Only the thumbnails wait. `?date=YYYY-MM-DD` picks the day
to land on and defaults to today. The current week stops at today (future days
only show in dev, as now).

Why: the first version kept one loaded block between two skeleton sentinels
and grew it as you scrolled. Every insert, span change or block swap changed
the scroll geometry mid-gesture, so the same flick threw different distances,
and touch feel is the whole point of the row. Mandatory snapping and holding
batches until the scroll settled only moved the problem around.

### Without JS

- The server draws the thumbnails for the week around `?date`. Other cards
  show their frame, name, number and stars, with an empty thumbnail box.
- The fragment scrolls the target card into view. Without a fragment, the
  `?date` card gets `scroll-initial-target` where the browser supports it.
- The month label above the row is the month of `?date`.

### With JS

- **Thumbnails are drawn as they near view.** A card outside the drawn week
  carries its board as `data-board`, the `encodeBoard` numbers joined with
  commas (about 100 bytes, against a few KB of SVG). One
  `IntersectionObserver` (root = the scroller, about 10 cards of margin each
  side) renders `Thumbnail` into the box with Preact the first time it comes
  near, then stops watching it. The same component draws it on the server and
  in the browser.
- **Filling a box never moves anything.** The box is `aspect-square` in a
  fixed-width column, so a drawn board takes exactly the space it had. Drawing
  mid-fling doesn't touch layout or momentum.
- **Drawn boards stay.** Nothing is unloaded; `content-visibility: auto` on the
  cards (with a `contain-intrinsic-size` from the column width) skips painting
  the ones off screen.
- **Mandatory snapping.** It was dropped once because it only stopped on
  loaded cards, so the edge of the loaded block stopped long flicks. With every
  card in the row that edge is gone, and a fling keeps its native distance
  and lands on a card.
- **Month links scroll in place.** Every day is already there, so a month link
  scrolls the row to that month's first day.
- The same island renders the **month label**. It tracks the centred card
  (`data-date` on each card) and updates the date and month as you scroll.
  Once the scroll settles (`scrollend`, or 150ms of idle scrolling where it
  isn't supported) it does `replaceState(?date=…)`, so a reload or back
  navigation returns to the same place. It doesn't set `aria-live`, because
  the label would chatter on every scroll.
- The row itself is a static component. The island attaches to it by id and
  never owns that DOM, so Preact's vdom and the server's markup don't conflict.

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
- Unit: `decodeBoard` round-trips `encodeBoard`, including a board without a
  puck or destination.
- e2e: rewrite `archives_test.ts` around the carousel. Clicking a card lands on
  the puzzle.

## Non-goals

- Filtering, search, or difficulty grouping.
- Unloading drawn thumbnails. A long scroll keeps everything it has drawn.
