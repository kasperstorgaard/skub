# E2E Tests for Skub — Spec

## Context

The game works fully server-side without JavaScript (progressive enhancement).
Client-side islands (Board, AutoPostSolution, CelebrationDialog, SolutionDialog)
layer on top of the server-rendered HTML. The e2e suite covers both paths.

All game state is encoded in URL query parameters (`moves`, `active`, `cursor`,
`dialog`). Identity is a UUID stored in an httpOnly cookie (`user_id`). A named
user has `name` persisted in Deno KV; anonymous users have no name.

## Framework

**Playwright** via `npm:playwright@^1` in `deno.json`, driven directly through
Deno — no `playwright.config.ts` wrapper. Each test file calls `setup()` from
`e2e/base.ts`, which launches a Chromium context and returns `{ page, asUser,
teardown }`. Tests use a **page object pattern** (`e2e/pages/`) for reusability.

Test files live under `e2e/` using the `*_test.ts` Deno suffix. Run with:

```bash
deno task e2e        # alias for: deno test -A e2e/
```

The dev server must be running on `http://localhost:5173` first.

## Tests

### `new-user-flow_test.ts`

1. **New user — tutorial → first puzzle → submit name**: navigate to home,
   follow the "new here" tutorial flow, solve the warm-up puzzle by clicking,
   submit a name via the solution dialog, assert the name appears on the
   solutions page.

2. **New user — keyboard-only solve → submit name**: navigate to the daily
   puzzle, solve it using `.focus()` + arrow keys only (no mouse), submit a
   name, assert it appears on the solutions page. This test exercises the full
   keyboard interaction path including the `useArrowKeys` hook.

### `returning-user-flow_test.ts`

3. **Returning player — JS solve → celebration dialog**: seed a named user,
   navigate to a puzzle, inject the solution URL, assert the celebration dialog
   opens with "Solved in N moves" heading and "See solves" link.

4. **Returning player — no JS → celebration dialog**: same as above with
   `javaScriptEnabled: false`. Server detects valid solution + existing name →
   posts → redirects to `?dialog=celebrate`.

5. **Returning player — duplicate solve dedup**: seed a user with an existing
   solution, re-submit the same moves, assert the celebration dialog still
   appears without error.

6. **Returning player — daily puzzle from homepage**: navigate home as a named
   user, click the daily puzzle link, solve by clicking, assert celebration
   dialog.

### `puzzle_test.ts`

7. **New player — JS solve → solution dialog**: anonymous user, inject solution
   URL, assert "Nice solve!" dialog with username input and submit button.

8. **New player — submit name → solutions page + replay**: fill the username,
   submit, assert redirect to solutions page, assert name in list, click the
   solve row, assert replay page renders with correct move count.

9. **No JS — new user plays archived puzzle → submit solve**: anonymous user,
   JS disabled, navigate to an archived puzzle with solution URL, assert
   server-side redirect to solution dialog, submit name.

### `profile_test.ts`

10. **Profile — anonymous renders without error**: navigate to `/me`, assert
    page renders (no 500, heading visible).

11. **Profile — named user sees saved username**: seed a named user, navigate
    to `/me`, assert the username is visible.

## Architecture

### `e2e/base.ts` — setup factory

```ts
const { page, asUser, teardown } = await setup();
await asUser("alice");   // seeds KV + sets user_id cookie
```

Each test uses a unique `crypto.randomUUID()` user ID. `teardown()` clears KV
entries and closes the browser.

### `e2e/pages/` — page objects

- `HomePage` — home, tutorial link, daily puzzle link
- `TutorialPage` — tutorial steps, warm-up puzzle link
- `PuzzlePage` — `solveByClicking()`, `solveByKeyboard()`, dialogs
- `SolutionsPage` — solution list, solve-by-name locator
- `ProfilePage` — profile heading, username
- `ArchivesPage` — archive puzzle links

### Solution computation

Solutions are computed dynamically via `getPuzzle(slug)` + `solveSync(puzzle)`
at test runtime — no static fixtures file. This keeps tests in sync with puzzle
changes automatically.

### Keyboard solving (`solveByKeyboard`)

Uses Playwright's `.focus()` to activate each piece, which triggers the board's
`onFocus` handler, re-rendering with guides. Then presses the arrow key to move.
The `useArrowKeys` hook uses a ref pattern (`onArrowKeyRef`) so the listener
stays registered between renders — avoiding the rAF re-registration gap that
would otherwise drop arrow key events immediately after a move.

## What NOT to Test

- Move encoding/decoding — covered in `game/strings_test.ts`, `game/url_test.ts`
- Board physics — covered in `game/board_test.ts`
- Solver correctness — covered in `game/solver_test.ts`
- Puzzle parser — covered in `game/parser_test.ts`
- Touch/swipe gestures — too fragile and device-specific; covered manually
- `AutoPostSolution` fetch error path — silent fail, not user-visible
- Stats percentile display variants — cosmetic, depends on KV data volume
- Invalid move URL params — not reachable through normal interaction
