# Archive revamp — calendar view

## Problem

The previous archive (`/puzzles`) was a paginated 6-per-page card grid sorted by puzzle number. Clunky and slow to explore: cards sparse, no filters, "what haven't I played" required scanning every page.

## Approach

Replaced the card grid with a **month-paginated calendar view**, inspired by Google Calendar's month view. Days are minimal cells with dots indicating play state. A wrapping list of months grouped by year drives navigation. Selecting a day populates a `PuzzleCard` preview to the right (desktop) or below (mobile); tapping the card opens the puzzle.

### Design principle: progressive disclosure

The grid is the **scan layer** — intentionally minimal so the eye can sweep a whole month. The preview pane is the **inspect layer** — anything richer than a dot belongs there.

- Grid cells carry only the cheapest signal: day number + tiny play-state dot.
- Anything richer (puzzle name, difficulty, move count, thumbnail) lives in the `PuzzleCard` preview.
- Future additions (streak badges, "new this week" markers) default to the preview unless they materially improve scanning.

### Calendar grid (`components/calendar-grid.tsx`)

- 7-column month grid; **first day of week derived from user locale** via `Intl.Locale(locale).getWeekInfo().firstDay`, read server-side from `Accept-Language` (fallback Monday). Helper: `lib/locale.ts`.
- **All days of the month render**, regardless of puzzle availability — empty/future days are dimmed, non-interactive cells.
- **No weekday header row** (Mon/Tue/…) — weekday-of-cell isn't meaningful in a puzzle archive.
- **Fixed cell height** (`h-14`) so cells don't jump when state changes.
- Selection ring uses `outline` (not `ring` / `border`) so it doesn't shift layout.
- Cell content:
  - Day number (large, neutral; dimmed `text-text-2` when no puzzle).
  - A small dot below, encoding play state — only completed/perfect days are marked:
    - **Solved, not optimal** → filled `bg-ui-1` (matches `ph-check` pill on cards).
    - **Solved, optimal** → filled `bg-ui-2` (matches `ph-trophy` pill on cards).
    - **Anything else (unplayed or empty)** → no dot (invisible spacer reserves space).
- Today's number gets a filled accent circle behind it (matches Google Calendar reference). State dot still applies underneath.
- **Difficulty intentionally not encoded in the grid.** It surfaces in the preview pane only — keeps grid vocabulary minimal and aligns with progressive disclosure.

### Month navigation (`components/month-strip.tsx`)

- **Wrapping list of month pills, grouped by year.** Each year has a heading (`{year}`) and pills for months that have at least one published puzzle.
- No horizontal scroll, no autofocus tricks — wraps naturally.
- Active pill filled (`bg-link text-surface-1`); others outlined.
- TODO: replace year heading with a dropdown when the archive spans many years (currently fine as headings since archive is small).

### Selected-day preview (`PuzzleCard` reused)

- The existing `PuzzleCard` component is reused as the preview pane on day select.
- `tagline` carries the formatted date (`"Sunday, 26 April"`); for today, appended with `" · today's puzzle"`.
- `href` override → routes to `/` when the selected day is today (preserves home-page-as-today). PuzzleCard's `{...rest}` spread sits after the explicit href, so a passed `href` wins.
- Empty fallback (no day selected, or day has no puzzle): a `border-1` placeholder card with `"Pick a day to see its puzzle."` / `"No puzzle on this day."`.

### Always-selected behaviour

The page must **always have a day selected** (no awkward empty preview state on first load).

- URL has `day=` → use it (clamped to month bounds).
- Otherwise → first day of the active month with a puzzle (lowest day number).
- Active month: `?month=YYYY-MM` if present, else most recent month with puzzles.
- `buildMonthHref` clears the `day` param when switching months, so month clicks always re-trigger first-day auto-selection.

### Layout

**Calendar left, preview right** on desktop. Stacks vertically on mobile.

- `Main` width: `lg:max-w-5xl` (broke out of the prior `lg:max-w-xl` cap because the calendar + card needs the room).
- `<section>` uses `lg:grid-cols-2 lg:gap-fl-4`. Month strip spans both columns at top (`lg:col-span-full`).
- Sidebar `Panel` keeps its current contents (totals, difficulty breakdown, "Build a puzzle" CTA).

### URL shape

- `/puzzles?month=2026-04` — active month
- `/puzzles?month=2026-04&day=12` — deep-link a selected day
- `f-client-nav` on the `<section>` makes navigation feel SPA-ish without an island.

### Data model

Critical: puzzles are positioned in the calendar by **release date**, computed from `number` (day-of-year) plus the year of `createdAt`. The `createdAt` timestamp alone is the file-save time and doesn't reflect when the puzzle is published — using it directly causes most of a month's puzzles to collapse onto a single day.

Helpers added in `game/loader.ts`:

- `getReleaseDate(entry)` — `new Date(year, 0, entry.number)` where `year = createdAt.getFullYear()`. Returns `null` for entries without a `number` (tutorial/onboarding).
- `listPuzzleMonths()` — descending list of `{year, month}` pairs that have at least one available puzzle, computed from release dates.
- `listPuzzlesInMonth(year, month)` — `Map<dayOfMonth, PuzzleManifestEntry>` for the requested month.

`getAvailableEntries()` (existing) filters out unreleased puzzles (`number > dayOfYear`), so the calendar naturally shows only released days.

## Non-goals

- No infinite scroll — paginated month-by-month.
- No filters in v1 — dot encoding handles scannability.
- No search by puzzle name — archive is browsable, not searchable.
- No streak visualisation in this PR.
- No favourites/bookmarks.
- No thumbnails inside calendar cells (PuzzleCard preview keeps the existing thumbnail).
- **No post-solve "Next unplayed" continuation flow** — separate topic (celebration dialog, solve handler, home-page flow). Own branch.

## Follow-up branches

- **Year dropdown** — replace the static year headings when the archive spans multiple years.
- **Post-solve continuation** — "Next unplayed" CTA in the celebration dialog, server-side computation of the nearest unplayed neighbour. Applies after both archive and home-page solves.
- **Filter pills** — only if archive scale demands them.
- **Streak visualisation** — explicit streak indicators on the calendar.

## Files touched

- `game/loader.ts` — added `getReleaseDate`, `listPuzzleMonths`, `listPuzzlesInMonth`.
- `lib/locale.ts` (new) — `getFirstDayOfWeek` and `pickLocale` (Accept-Language → tag).
- `components/calendar-grid.tsx` (new) — server-rendered grid; locale-aware first day; fixed-height cells; outline-based selection ring; dot encoding (hollow ring unplayed / filled ui-1 solved / filled ui-2 optimal).
- `components/month-strip.tsx` (new) — year-grouped wrapping pill list.
- `routes/puzzles/index.tsx` — handler computes active month + always-selected day; layout split.
- `routes/puzzles/_e2e/archives_test.ts` & `archives-page.ts` — rewritten for the new flow (heading + click-day-then-card-to-navigate).

## Inspiration

- Google Calendar month view (mobile reference shared by user)
- NYT Crossword / Connections Companion archive (calendar + completion stars)
- Puzzmo shelf-by-difficulty (rejected — calendar wins for daily cadence)

## Known issues / TODOs

- E2E test `archives — clicking the selected-day detail navigates to the puzzle` failed on the previous run; selector needs updating after the layout switch from `SelectedDayPanel` (now deleted) to `PuzzleCard`. The other two archive tests pass.
- `f-client-nav` adds `aria-current="page"` and `data-current="true"` to every `<a>` whose href shares the path — affects both the month pills (all month pills get `aria-current="page"`) and gridcell day anchors. Not a blocker but means tests can't rely on `aria-current` to identify "the active month/day". Use the explicit `bg-link` class on the active month pill or the URL itself for selectors.
