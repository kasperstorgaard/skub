# Puzzle route middleware

## Problem

Every handler under `routes/puzzles/[slug]/` independently calls `getPuzzle(slug)` and
throws a 404 if the puzzle is missing. This duplicates the same load-and-guard pattern
across six files.

## Solution

Add a route-level middleware at `routes/puzzles/[slug]/_middleware.ts` that loads the
puzzle once and stashes it on `ctx.state.puzzle`. The same file exports a sub-tree
`define = createDefine<PuzzleState>()` (where `PuzzleState = State & { puzzle: Puzzle }`),
so handlers in this subtree get a non-optional `ctx.state.puzzle` without runtime
guards or `!` assertions.

### Changes

- **`routes/puzzles/[slug]/_middleware.ts`** (new) — loads puzzle via `getPuzzle`,
  throws 404 if missing, sets `ctx.state.puzzle`. Also exports a `define` bound to
  `PuzzleState` for use by sibling handlers.
- **`routes/puzzles/[slug]/index.tsx`** — read puzzle from `ctx.state`, swap import
  to the local `define`.
- **`routes/puzzles/[slug]/solutions/index.tsx`** — same.
- **`routes/puzzles/[slug]/solutions/[solutionId]/index.tsx`** — same.
- **`routes/puzzles/[slug]/(actions)/clone.ts`** — same.
- **`routes/puzzles/[slug]/(actions)/hint.ts`** — same.
- **`routes/puzzles/[slug]/og-image/index.tsx`** — same.
- **`core.ts`** — unchanged. The puzzle field lives in `PuzzleState`, not the
  shared `State`, since it is only populated under one subtree.

### Solve action removed

The previous `routes/puzzles/[slug]/(actions)/solve.ts` only made sense for the
`preview` slug (a user's draft puzzle, not a real puzzle file). The new middleware
would have 404'd for `/puzzles/preview/solve` since no puzzle file matches.

Rather than special-casing the middleware, the solve action is folded into the
preview page itself: `routes/puzzles/preview/index.tsx` redirects to
`?dialog=solve` on first GET, so the solve dialog opens automatically when previewing
a draft. The `getSolveHref` helper and the conditional "Solve" CTA in the controls
panel are gone.

## Non-goals

- No KV reads in the middleware
- No future-puzzle guarding (separate concern)
