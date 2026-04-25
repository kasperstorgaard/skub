# Endgame puzzle — Loke

## Problem

Players who solve every available puzzle optimally have nothing left to do on
the home page. The random puzzle slot shows puzzles they've already perfected.

## Solution

When a player has solved every eligible puzzle at minimum moves, the random
puzzle slot shows **Loke** — a hidden ultra-difficulty puzzle. No special UI
or messaging — it's just a puzzle card like any other. If perfected, it shows
the optimal badge like any other perfected puzzle.

### Loke puzzle

- `static/puzzles/loke.md` — no number, `hidden: true`, difficulty `"ultra"`
- Always accessible by direct slug link (middleware skips numberless puzzles)
- Excluded from archives, streak, and random pool via `hidden` flag

### Ultra difficulty

Add `"ultra"` to `Difficulty` type — one-off tier specific to Loke. Comment
in `game/types.ts` documents this.

### Home page changes (`routes/index.tsx`)

1. Compute `getBestMoves(solutions)` for all user solutions
2. Compare against `entry.minMoves` from `getAvailableEntries()` (cached)
3. If all eligible puzzles are solved optimally → load Loke via
   `getPuzzle("loke")` and show it in the random puzzle slot
4. Otherwise → normal random puzzle flow

Once Loke appears, it stays — even after being solved or perfected. The
random slot permanently becomes the Loke slot for that player.

### Depends on

- `fix/future-puzzle-guard` — adds `hidden` flag to puzzle model

## Files

- **added** `static/puzzles/loke.md` — the hidden endgame puzzle
- **modified** `game/types.ts` — `"ultra"` added to `DIFFICULTIES`
- **modified** `game/loader.ts` — `ultra` in difficulty breakdown
- **modified** `routes/index.tsx` — endgame detection, Loke as random fallback
