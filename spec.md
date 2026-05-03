# Celebration transition: ripple animation + client-side post

## Problem

Two independent issues:

1. The existing post-solve animation (board explosion) is too long and
   destructive — tiles fly off screen, leaving nothing behind. A shorter
   celebratory ripple that leaves the board intact is a better fit.

2. `AutoPostSolution` uses `redirect: "follow"` against the page POST route
   to discover the resulting URL. This fetches a full HTML page just to read
   `response.url` — wasteful, and couples the client to server redirect logic.

## Changes

### 1. Ripple animation (replaces board explosion)

A scale + brightness pulse radiates outward ring by ring from the destination
tile. All tiles in a ring fire simultaneously (~80ms between rings, 250ms per
tile animation). Total: ~810ms. Board returns to normal — no tiles leave the
screen.

CSS trigger: `data-rippling="true"` on the board wrapper. Per-tile delay
(`--ripple-delay`) set by a JS-generated stylesheet (`lib/board-ripple.ts`),
keyed by `data-exit-key`. Properties animated: `transform: scale(...)` +
`filter: brightness(...)` — both on the compositor, no layout.

Actors (pieces, walls, destination marker) are not animated — they sit on top
of the ripple naturally.

`lib/board-exit.ts` → `lib/board-ripple.ts` (renamed + rewritten, same
`{ css, totalMs }` shape).

### 2. Dialog fade-in

Dialog opens after ripple completes. `MIN_WAIT_FLOOR_MS` lowered to 900ms
(ripple is ~810ms). The existing `dialog[open]` CSS transition handles the
fade-in. `exitDurationMs` signal renamed to `rippleDurationMs`.

### 3. Client-side auto-post via `/api/solutions`

New `POST /api/solutions` endpoint returns JSON `{ isNewPath: boolean }`.
Same KV writes, analytics, and skill-level assessment as the existing page
POST — just no redirect.

`AutoPostSolution` now:
- POSTs to `/api/solutions` (formdata with `name`, `moves`, `puzzleSlug`)
- Receives JSON, constructs `?dialog=celebrate[&new_path=true]` URL itself
- No `redirect: "follow"`, no `response.url` reading

The page POST at `/puzzles/[slug]` is unchanged — still handles the no-JS
path and solution-dialog submissions.

## Non-goals

- No-JS path unchanged.

## Follow-up: hide optimal score pre-solve

`minMoves` is currently passed to the client on page load (drives the board
difficulty badge and the "Perfect" headline). A follow-up PR will:

- Withhold `minMoves` from the initial page data
- Have `/api/solutions` return `{ isNewPath, isOptimal }` so the celebration
  dialog can show "Perfect — X moves" without needing `minMoves` beforehand
- Open the door for richer messaging: "only X% of solvers matched or beat this"
  using the solutions histogram already available in `celebrate-stats`
- Remove or defer the `DifficultyBadge` `minMoves` display until after solving
