# Fix relative URL generation and tutorial bugs

## Problem

Two related issues:

1. URL-building helpers in `game/url.ts` returned absolute URLs (e.g.
   `http://example.com/puzzles/test?moves=...`), causing inconsistencies when
   used as `href` attributes or passed to `history.pushState`.

2. The tutorial had two bugs:
   - `showMeUrl` was passed as a `URL` object in page data, then manually
     unpacked in the component — fragile and unnecessary.
   - The "Dismiss" button on the welcome step was a form POST that the handler
     couldn't handle (no moves → JSON parse error). The intended behaviour was
     to go home.

## Changes

### `game/url.ts`

- Added `BASE_URL = "http://example.com"` dummy base for parsing relative hrefs.
- Added `toRelative(url)` helper (`pathname + search`).
- All href-building functions (`getMovesHref`, `getActiveHref`, `getUndoHref`,
  `getRedoHref`, `getResetHref`, `getHintHref`, `getSolveHref`) now accept
  relative hrefs and return relative paths.
- Read-only functions (`decodeState`, `getReplaySpeed`, `getDifficulty`,
  `getPage`) accept both `URL` and relative string via the same base trick.

### `game/url_test.ts`

- All tests updated to use relative URL inputs and expect relative outputs.

### `routes/puzzles/tutorial/index.tsx`

- `showMeUrl: URL` in `Data` replaced with `showMeHref: string` — built
  directly as a relative path using `URLSearchParams`.

### `islands/tutorial-dialog.tsx`

- `getStepLink` and `tryItHref` now use `new URL(href, BASE_URL)` for
  consistency and to handle relative hrefs safely.
- "Dismiss" button changed from a form POST (broken — no moves to submit) to
  `<a href="/">` taking the user home.

## Files

- **modified** `game/url.ts`
- **modified** `game/url_test.ts`
- **modified** `routes/puzzles/tutorial/index.tsx`
- **modified** `islands/tutorial-dialog.tsx`
