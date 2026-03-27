# Refactor: saveSolution with built-in duplicate check

## Problem

Previously, solution saving required two separate calls: `getCanonicalUserSolution` to check for duplicates, then `addSolution` to write. Call sites had to manage this two-step dance and risk introducing logic errors (e.g. accidentally saving duplicates, or skipping saves).

## Solution

Merged into a single `saveSolution` function that handles deduplication internally and returns a flat result object:

```ts
type SaveSolutionResult = {
  solution: Solution;
  isNew: boolean;
  isNewPath: boolean;
};
```

On duplicate, returns the existing solution with `isNew: false, isNewPath: false`. Call sites check `result.isNew` to branch on first-time vs duplicate.

## Changes

### `db/solutions.ts`
- Added `saveSolution(payload)` — checks for existing canonical user solution, writes atomically, returns discriminated union
- `getCanonicalUserSolution` is now a private helper (not exported)
- `addSolution` removed

### `routes/puzzles/[slug]/index.tsx`
- GET handler: redirects anonymous users (`!savedName`) to solution dialog; named users call `saveSolution` directly — dedup is handled internally
- POST handler: calls `saveSolution`; returns early on `!result.isNew` without re-saving
- Both handlers read `result.isNewPath` only when `result.isNew === true`

### `routes/api/e2e/solutions/index.ts`
- Updated to call `saveSolution`; returns 409 on duplicate
