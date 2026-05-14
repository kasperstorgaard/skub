# Hide ideal move count + celebration tier redesign

Closes #181.

## Problem

Two related issues, addressed together:

1. **Optimal move count is revealed up-front.** `DifficultyBadge` and
   `HintDialog` both show `minMoves` before the user has solved the puzzle.
   The issue suggests withholding it adds suspense — finding out how close
   to perfect you are becomes the payoff.

2. **The current celebration body relies on streak / "new canonical path" /
   first-solver framings.** None of these answer the question the player
   actually cares about: how does my solve compare to others? The streak
   framing is especially misleading — players replay puzzles, so streaks
   don't carry the meaning they used to.

## Approach

Two-dimensional celebration model:

- **Headline** conveys closeness to perfect (Perfect / Great / Solved)
- **Body** conveys comparison context against other solvers

`minMoves` stays on the client (the puzzle object). It's not a secret — the
hide is purely UI.

## Changes

### 1. Hide `minMoves` until previously solved

`routes/puzzles/[slug]/index.tsx` GET handler fetches a cheap
`listUserPuzzleSolutions(userId, slug, { limit: 1 })` (wrapped in try/catch
with `hasSolved = false` fallback so KV blips don't 500 the page) and
exposes `hasSolved: boolean` in `PageData`.

- **`DifficultyBadge`**: new `hideMinMoves` prop. When set, renders `?`
  with a "solve the puzzle to reveal" tooltip.
- **`HintDialog`**: new `hideMinMoves` prop. Drops all numeric leaks:
  - "Found it — N moves to go" → "Found it — almost there" (≤2) /
    "some way to go" (3+)
  - Off-track copy "you'll need X moves total (optimal is Y)" →
    "there are much shorter paths"

### 2. Celebration tier redesign

Drop the existing rarity-ranked cases (first-solver, first-optimal,
new-path, streak-milestone, streak, other-solvers). Replace with a
two-dimensional model: headline conveys closeness, body conveys context.

**Headline** (driven by `moveCount` vs `puzzle.minMoves`):

| Condition | Headline |
|---|---|
| `moveCount === minMoves` | "Perfect — N moves!" |
| `moveCount ≤ minMoves + 2` | "Great — N moves!" |
| else | "Solved — N moves" |

Named tiers (Perfect / Great) keep the exclamation; baseline ("Solved")
is neutral — exclamation would read as sarcasm at high move counts.

**Body case** (achievement-noun style — sets up for a future achievements
feature). Each case has 3 wording variants picked randomly for variety,
stored in a `messages` lookup table:

| Case | Condition |
|---|---|
| `champion` | Perfect AND `histogram[minMoves] ≤ 1` (only this user at perfect) |
| `perfectionist` | Perfect, others have also hit it |
| `pioneer` | `totalSolutions ≤ 1` (only this user has solved) |
| `creative` | `isNewPath === true` (found a canonical path no one else has) |
| `adept` | `totalSolutions ≥ 10` AND beat ≥40% of solves |
| `fallback` | Everything else |

Precedence (top-down — first match wins): champion → perfectionist →
pioneer → creative → adept → fallback.

"Beat ≥40%" = `solves_with_more_moves / totalSolutions ≥ 0.4`.
Percentages rounded to nearest integer.

Example body strings (one variant shown; each case has 3). Bodies are
factual fragments — no terminal punctuation, no praise word stacked on
top of the headline (which already carries "Perfect" / "Great"):

| Case | Example |
|---|---|
| `champion` | "First to nail it" |
| `perfectionist` | "Top X% of solves" |
| `pioneer` | "First solve in the books" |
| `creative` | "Nice thinking, that's a creative solution" |
| `adept` | "Better than X% of solves" |
| `fallback` | "Joined X others" |

### 3. Extract celebration logic to `game/celebration.ts`

Pure logic moves out of the dialog island:

- `getCelebrationType(moveCount, puzzle, { puzzleStats, isNewPath })`
  returns a `CelebrationType` string union
- `countSolvesAbove(histogram, moveCount)` helper

The dialog imports both, plus a local `getMessage(type, moveCount,
puzzleStats)` that maps type → random body. Tested in isolation
(`game/celebration_test.ts`, 14 cases covering all 6 types + precedence
edges + threshold boundaries).

### 4. Drop unused signal references + simplify hint state

- `userStats` removed from `CelebrationData` and the POST response —
  streak data no longer surfaced in the celebration. Saves a per-solve
  KV call.
- `HintDialog`'s `useDelayedValue` hook + depth-tracking queue ripped
  out. Replaced with plain `useState<SolveState | null>` matching
  `SolveDialog`'s pattern. Hook file (`client/use-delayed-value.ts`)
  deleted — only consumer.
- `HintDialog` solving state now shows a single line:
  "Crunching the possibilities…" (with loading dots), gated by a
  `MIN_THINK_MS = 3000` minimum hold via a stored promise, so the hint
  feels earned. Hints are 1/day, so the perceived weight matters.

### 5. Achievements: vocabulary only, not the storage model

The case names (`pioneer`, `champion`, `perfectionist`, `adept`,
`creative`, `fallback`) borrow achievement-style nouns to set up a future
achievements feature. But this PR only ships the *vocabulary* — the
celebration type is recomputed fresh from current `puzzleStats` every
time the dialog opens.

A real achievements feature would need:

- The earned type persisted at solve time (otherwise `pioneer` flips to
  `fallback` once others solve it, and the user "loses" their badge)
- The data that justified it stored (move count, total solves at time
  of earn) for later "X% rarity" display
- Stable rules — once earned, never lost (or clear loss rules)

Out of scope here.

## Non-goals

- Visual histogram / bar chart in the celebration dialog (separate PR;
  only relevant when ≥10 solves accumulate)
- Personal-best overlay ("New personal best!") — the player remembers
  their previous solve
- No-JS path celebration — no-JS users still redirect to `/solutions`
  (separate concern)
- Data-derived puzzle difficulty (a future direction enabled by this
  PR's tier system, but not in scope here)
