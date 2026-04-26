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

Composes with the existing "exclude perfected puzzles from random" logic
from main:

1. Compute `getBestMoves(solutions)` once for the user's solutions
2. Derive `optimalSlugs` — entries where `bestMoves[slug] === entry.minMoves`
3. `allPerfected` — every entry with a `minMoves` is in `optimalSlugs`
4. If `allPerfected` → load Loke via `getPuzzle("loke")`
5. Otherwise → `getRandomPuzzle` excluding daily + `optimalSlugs`

Once Loke appears, it stays — even after being solved or perfected. The
random slot permanently becomes the Loke slot for that player.

### Parser fix (`game/parser.ts`)

The Loke board uses combining marks (`X̲`, `#̲`) which add extra codepoints
per cell. The previous row matcher captured a fixed 16 chars after the row
number, so any horizontal wall in column H of a row containing combining
marks was silently dropped before reaching `parseBoard`.

Replaced `(.{16})` with a variable-length capture bounded by the trailing
` |` boundary so cells past the combining marks are preserved.

### Depends on

- `fix/future-puzzle-guard` — adds `hidden` flag to puzzle model

## Files

- **added** `static/puzzles/loke.md` — the hidden endgame puzzle (15-move ultra)
- **modified** `game/parser.ts` — row matcher captures variable-length content
- **modified** `game/types.ts` — `"ultra"` added to `DIFFICULTIES`
- **modified** `game/loader.ts` — `ultra` in difficulty breakdown
- **modified** `routes/index.tsx` — endgame detection, Loke as random fallback
