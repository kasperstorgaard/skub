# Simplify puzzle route solve paths

## Problem

`routes/puzzles/[slug]/index.tsx` GET handler had unnecessary complexity:

1. A stats fetch for `dialog=celebrate` that was redundant — JS users get fresh stats
   via the island fetch, and the no-JS path doesn't land on celebrate.
2. A named-user fast path in no-JS solve detection that duplicated save/track logic
   from POST and caused the server and client paths to diverge conceptually.

E2e tests used `gotoWithSolution` — a helper that encoded moves directly into the URL
and navigated there. No real page in the app produces such a URL, so this bypassed the
actual board interaction.

## Solution

### 1. Remove celebrate stats fetch from GET

GET fetched `puzzleStats` and `userStats` when `dialog=celebrate` was in the URL.
Removed — GET now always returns `defaultPuzzleStats` and `userStats: null`.

### 2. Unify no-JS solve path via SolutionDialog

GET previously had two no-JS branches: anonymous users went to SolutionDialog, named
users saved directly and jumped to celebrate. Now GET always redirects to
`?dialog=solution` on a valid solve. All saving goes through POST.

SolutionDialog opens on `dialog=solution` in addition to the existing JS anonymous
detect. Copy is conditional: named users see "Claim your solve to see how others did
it.", anonymous users see "Pick a name and see how others did it."

JS named users are unaffected — `AutoPostSolution` posts directly and bypasses the
dialog entirely.

### 3. `getSolveRedirectUrl` helper

Extracted the redirect URL construction from POST into a local helper:
`getSolveRedirectUrl(ctx, source, options?)`. Takes ctx for slug and referer,
source as the branching subject, isNewPath as an optional modifier.

### 4. Remove `gotoWithSolution`, require moves in `solveByClicking`

`gotoWithSolution` removed from `PuzzlePage`. `solveByClicking` now requires
`moves: Move[]` passed in from outside — callers use `solvePuzzle(slug)` from helpers
to get the solution first, then replay it through the board UI.

This aligns tests with the integration test principle: exercise components on the page
directly, don't skip page interactions via synthetic URL state.

## Behaviour changes

No-JS named users now see SolutionDialog (pre-filled name) instead of being saved
silently and jumping straight to celebrate. One extra click to confirm.

## Files

- **modified** `routes/puzzles/[slug]/index.tsx` — remove celebrate stats fetch, simplify no-JS path, extract `getSolveRedirectUrl`
- **modified** `islands/solution-dialog.tsx` — open on `dialog=solution`, conditional copy for named vs anonymous users
- **modified** `CLAUDE.md` — function argument ordering is exempt for side-effect-only functions
- **modified** `routes/puzzles/[slug]/_e2e/puzzle-page.ts` — remove `gotoWithSolution`, `solveByClicking` now requires `moves`
- **modified** `routes/puzzles/[slug]/_e2e/puzzle_test.ts` — all tests use `goto` + `solveByClicking(moves)`
- **modified** `e2e/new-user-flow_test.ts` — `solveByClicking` updated with moves
- **modified** `e2e/returning-user-flow_test.ts` — `solveByClicking` updated with moves; no-JS named user now expects SolutionDialog
