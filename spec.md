# E2E Tests for Skub — Spec

## Context

The game works fully server-side without JavaScript (progressive enhancement).
Client-side islands (Board, AutoPostSolution, CelebrationDialog, SolutionDialog)
layer on top of the server-rendered HTML. The e2e suite must cover both paths.

All game state is encoded in URL query parameters (`moves`, `active`, `cursor`,
`dialog`). Identity is a UUID stored in an httpOnly cookie (`user_id`). A named
user has `name` persisted in Deno KV; anonymous users have no name.

## Framework

**Playwright** via the existing `npm:playwright@^1` import already present in
`deno.json`. The project's `scripts/screenshots.ts` already uses it with
`chromium` and `devices`, so no additional install is needed.

Test files live under `e2e/` at the project root, using the `*_test.ts` Deno
suffix convention. A new `deno task e2e` task will run them against a local dev
server. Tests are not run by `deno test -A` (which runs unit tests only); the
e2e task starts the server first.

Playwright is driven through Deno directly — no `playwright.config.ts` wrapper.
Each test file imports `chromium` from `playwright`, launches a browser context,
and tears it down. This matches the existing screenshots script pattern and
avoids any Node/npm toolchain.

## What to Test

### 1. Named user — JS solve → auto-post → celebration dialog

1. Seed a named user by setting `user_id` cookie + KV record with `name`.
2. Navigate to `/puzzles/alf` (8-move medium puzzle, known solution).
3. Inject the solution URL directly (`?moves=...`) to bypass UI interaction.
4. The `AutoPostSolution` island fires a POST and updates `href` to
   `?dialog=celebrate`.
5. Assert the `CelebrationDialog` is open: heading "Solved in N moves" is
   visible, "See solves" link points to `/puzzles/alf/solutions`.

### 2. Named user — server-side solve → celebration dialog (no JS)

1. Seed the named user cookie only (no JS needed).
2. Navigate directly to `/puzzles/alf?moves=<valid-solution>` with JS disabled
   (Playwright `javaScriptEnabled: false` context).
3. Server detects a valid solution + existing name → posts solution → redirects
   to `?dialog=celebrate`.
4. Assert the page URL ends with `dialog=celebrate` and the heading is present
   in the HTML.

### 3. Anonymous user — JS solve → solution dialog

1. Fresh browser context (no `user_id` cookie, no name).
2. Navigate to `/puzzles/alf?moves=<valid-solution>`.
3. Server detects valid solution + no name → redirects to `?dialog=solution`.
4. Assert the `SolutionDialog` is open: "Nice solve!" heading, username input,
   "Post your solve" button.

### 4. Anonymous user — solution dialog submit → solutions page

1. Continue from test 3 (or re-seed).
2. Fill the username input with a test name (e.g. `e2etest`), submit the form.
3. Server POST at `/puzzles/alf` receives `source=solution-dialog` → redirects
   to `/puzzles/alf/solutions`.
4. Assert the solutions page loads and the submitted name appears in the list.
5. Click the submitted solve row → navigates to `/puzzles/alf/solutions/<id>`.
6. Assert the solution replay page renders: puzzle heading visible, move count
   matches what was submitted.

### 5. Named user — duplicate solve dedup

1. Seed a named user who already has an existing solution for `alf` (same
   canonical move set).
2. Navigate to `/puzzles/alf?moves=<same-solution>` with JS disabled.
3. Server finds duplicate → skips `addSolution` → still redirects to
   `?dialog=celebrate`.
4. Assert URL ends with `dialog=celebrate` without an error.

### 6. Tutorial

1. Navigate to `/puzzles/tutorial`.
2. Assert the board renders and the puzzle heading is visible.
3. Inject the tutorial solution URL (`?moves=...`).
4. Assert the solve dialog opens (tutorial puzzle has no minMoves requirement —
   confirm the right dialog variant appears).
5. Assert no solution is posted (tutorial solutions are blocked server-side).

### 7. Profile smoke

1. Navigate to `/me` as an anonymous user.
2. Assert the page renders without error (no crash, no 500).
3. Seed a named user with a couple of solutions, navigate to `/me`.
4. Assert the user's name and at least one stat (total solves) is visible.


## What NOT to Test

- Move encoding/decoding (`encodeMoves`, `decodeMoves`, `decodeState`) —
  exhaustively covered in `game/strings_test.ts` and `game/url_test.ts`.
- Board physics (`resolveMoves`, `isValidSolution`, `getTargets`) — covered in
  `game/board_test.ts`.
- Solver correctness — covered in `game/solver_test.ts`.
- Puzzle parser — covered in `game/parser_test.ts`.
- Touch/swipe gesture handling — too fragile and device-specific; covered
  manually.
- `AutoPostSolution` fetch error path (silent fail) — internal client state,
  not user-visible.
- Stats percentile display variants — cosmetic, depends on KV data volume.
- Invalid move URL params — internal redirect, not reachable through normal interaction.

## Test Fixtures

### Test puzzle: `alf`

Use the existing `static/puzzles/alf.md` (slug `alf`). The known minimum
solution must be derived once using the solver and committed as a constant in
`e2e/fixtures.ts`:

```ts
// e2e/fixtures.ts
export const ALF_SOLUTION_MOVES = "<encoded-moves-string>";
export const ALF_PUZZLE_SLUG = "alf";
```

This avoids running the solver in tests and makes assertions deterministic.

### User state helpers

`e2e/helpers.ts` exposes two functions:

- `seedNamedUser(context, name)` — generates a UUID, sets the `user_id` cookie
  on the browser context, and writes `{ name }` directly to the local Deno KV
  store (opened via `Deno.openKv()` in the test process).
- `clearTestUser(userId)` — deletes all KV entries for the test user UUID
  after each test.

Each test uses a unique `user_id` UUID (`crypto.randomUUID()`) to avoid
interference when run in parallel. Direct KV access requires the same KV path
as the dev server — use the default (no `DENO_KV_PATH` set) so both processes
share the same local store.

## Running Tests

### Local

```bash
# Terminal 1
deno task dev

# Terminal 2
deno task e2e
```

Add to `deno.json`:

```json
"e2e": "deno test -A e2e/"
```

The dev server must be running on `http://localhost:5173` before the suite runs.
Tests skip gracefully when the server is unreachable.

## Open Questions

- **ALF_SOLUTION_MOVES constant**: derive once by running the solver against
  `alf` and commit the result.
- **Shared KV path**: confirm the dev server and test process both use the
  default local KV path with no extra config needed.
