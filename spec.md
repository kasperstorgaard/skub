# Exclude optimally solved puzzles from random

## Problem

The home page random puzzle can land on a puzzle the user has already solved
at minimum moves. There's nothing left to achieve — no better move count to
chase. This wastes the one random slot.

## Solution

Exclude puzzles where the user's best solve equals `minMoves` from the random
puzzle pool. Already-solved-but-not-optimal puzzles stay eligible — there's
still a reason to revisit them.

### Changes to `routes/index.tsx`

1. Compute `getBestMoves(solutions)` for all user solutions (currently filtered
   to daily+random only — widen to all)
2. Build optimal slug set by comparing against `entry.minMoves` from
   `getAvailableEntries()` (cached, free)
3. Pass optimal slugs to `getRandomPuzzle` via `excludeSlugs`

```
const allBestMoves = getBestMoves(solutions);
const entries = await getAvailableEntries();
const optimalSlugs = entries
  .filter(e => allBestMoves[e.slug] === e.minMoves)
  .map(e => e.slug);
```

### `getRandomPuzzle` — return `null` on empty pool

Currently throws when no entries match. Change to return `null` so the caller
can handle the empty case. This is needed by both this PR and the endgame PR.

### What this does NOT do

- No new KV reads — `solutions` is already fetched
- No UI changes — the random puzzle card looks the same
- No changes to `getBestMoves`
- Doesn't affect the daily puzzle or onboarding puzzle slots
