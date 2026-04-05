# Fresh Partials for archive pagination and header navigation

## Problem

Archive pagination and header navigation cause full page reloads — re-downloading
the JS bundle, re-running island hydration from scratch. Perceived navigation is
slower than it needs to be, especially for archive pagination where the page
shell is identical between pages.

## Solution

Opt-in Fresh Partials on the two areas where client-side navigation adds clear
value, without touching the rest of the app.

### 1. `routes/_app.tsx` — partial target

Wrap `<Component />` in `<Partial name="body">`. This is the swap target for all
partial navigations — Fresh fetches the new page, extracts the matching partial,
and replaces it in the DOM. No `f-client-nav` on the body itself.

### 2. `components/header.tsx` — header navigation

Add `f-client-nav` to the `<header>` element. Covers:
- Back button (puzzle → archives, puzzle → home, etc.)
- Profile link

### 3. `routes/puzzles/index.tsx` — archive pagination

Add `f-client-nav` to the `<section>` wrapping the puzzle card grid and
pagination controls. Covers:
- Pagination page links
- Puzzle card links (navigate to puzzle page as a partial)

## What was explicitly left out

Global `f-client-nav` on the body was tried and reverted — it intercepted POST
forms (cookie banner, tutorial dismiss, profile save) and `data-router="replace"`
links in the board/controls islands, causing conflicts. Opt-in is cleaner.

View transitions (`f-view-transition`) were tried but not pursued — no visible
effect without explicit `::view-transition-*` CSS, and the crossfade didn't add
enough value to justify the added complexity.

## Files

- **modified** `routes/_app.tsx` — `<Partial name="body">` wrapping `<Component />`
- **modified** `components/header.tsx` — `f-client-nav` on `<header>`
- **modified** `routes/puzzles/index.tsx` — `f-client-nav` on archive `<section>`
