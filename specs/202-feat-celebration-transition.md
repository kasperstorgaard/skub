# Celebration transition: ripple animation + signal-driven flow

## Problem

Three issues, addressed together:

1. The existing post-solve animation (board explosion) was too long and
   destructive — tiles flew off screen, leaving nothing behind.
2. `AutoPostSolution` used `redirect: "follow"` against the page POST and
   read `response.url` to discover where to navigate — wasteful (full HTML
   for a tiny string) and tightly coupled the client to server redirect
   shape.
3. The celebration flow accumulated coordinating state — `isSubmitting`,
   `isNewPath` URL param, `?dialog=celebrate` URL convention, a separate
   `/api/celebrate-stats` fetch, `statsSettled`/`statsError` signals — each
   piece making sense in isolation but the whole tangling persistence,
   navigation, and UX into one knotted flow.

## Changes

### 1. Ripple animation (replaces board explosion)

A scale + brightness pulse radiates outward ring by ring from the
destination tile. All tiles in a ring fire simultaneously (~80ms between
rings, 250ms per tile). Total ~810ms. Board returns to normal.

The `tile-ripple` class is applied conditionally (only when `hasSolution`)
so it doesn't create a stacking context during normal play, which would
block guide clicks.

`lib/board-exit.ts` → `lib/board-ripple.ts` (renamed + rewritten, same
`{ css, totalMs }` shape).

### 2. Single POST endpoint, dual contract by `Content-Type`

The page POST handler at `/puzzles/[slug]` is the only solution endpoint.
Its contract:

- **`Content-Type: application/json`** (fetch from `AutoPostSolution`):
  saves the solution, runs analytics + skill assessment, returns
  `{ isNewPath, puzzleStats, userStats }` as JSON. No redirect. The client
  decides what to do.
- **Form encoding** (no-JS submit from `SolutionDialog`): saves and
  redirects to `/puzzles/[slug]/solutions`. No celebration shown — no-JS
  users go straight to the leaderboard, accepted as a fair trade.

`/api/solutions` and `/api/celebrate-stats` deleted.

The tutorial page's POST follows the same shape: JSON for auto-post (303
redirect to `?tutorial_step=solved`, fetch follows), form for the
"I'm ready" button (303 home).

### 3. Signal-driven celebration

The puzzle page owns two signals:

- `celebrationData: Signal<CelebrationData | null>` — populated by the
  POST response.
- `celebrationError: Signal<boolean>` — set if the POST fails.

`AutoPostSolution`:
- Renders nothing.
- One job: on solve detection, POST as JSON, set `celebrationData` (or
  `celebrationError` on failure). If the response was redirected (tutorial
  case), navigates to `response.url` instead.
- Mounted only when the user has a saved name.

`CelebrationDialog`:
- Opens on `hasSolution && minElapsed` — purely client-side solve
  detection, no URL `?dialog=celebrate` convention.
- Reads `celebrationData` for the enriched body, falls back to defaults
  while the POST is pending. Shows "Couldn't load stats" on error.
- Mounted only when the user has a saved name (paired with
  `AutoPostSolution`).

`SolutionDialog` is unchanged in role — still the unnamed-user form. Its
`isOpen` check no longer needs to exclude `?dialog=celebrate` (that URL
state is gone).

## What this kills

- `?dialog=celebrate` URL state
- `?new_path=true` URL param
- `source` form field branching in the POST handler
- `getSuccessHref` callback prop on `AutoPostSolution`
- `response.url` follow-the-redirect dance
- `isSubmitting` signal (collapsed into `celebrationData === null`)
- Internal `celebrate-stats` fetch in the dialog
- `/api/solutions` and `/api/celebrate-stats` routes

## Non-goals

- No-JS users do not see the celebration dialog. They land on the
  leaderboard. The leaderboard is itself a kind of celebration.

## Follow-up: hide optimal score pre-solve

`minMoves` is currently passed to the client on page load. A follow-up:

- Withhold `minMoves` from the initial page data
- Have the POST response carry `isOptimal` so the dialog can show
  "Perfect — X moves" without `minMoves` beforehand
- Defer `DifficultyBadge`'s `minMoves` display until after solving
