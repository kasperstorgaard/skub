# Hide ideal move count + celebration redesign

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

- **Headline** conveys closeness to optimal (Perfect / Great solve / Solved)
- **Body** conveys comparison context against other solvers

`minMoves` stays on the client (the puzzle object). It's not a secret — the
hide is purely UI. `CelebrationDialog` still reads `puzzle.minMoves`
directly for the closeness check.

## Changes

### 1. Hide `minMoves` until previously solved

`routes/puzzles/[slug]/index.tsx` GET handler fetches a cheap
`listUserPuzzleSolutions(userId, slug, { limit: 1 })` and exposes
`hasSolved: boolean` in `PageData`.

- **`DifficultyBadge`**: new `hideMinMoves` prop. When set, renders `?`
  with a "solve the puzzle to reveal" tooltip.
- **`HintDialog`**: new `hideMinMoves` prop. Drops the
  "(optimal is X)" parenthetical and any totals that imply optimal.

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
| `champion` | Perfect AND `histogram[minMoves] === 1` (only this user at perfect) |
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
| `creative` | "A creative path" |
| `adept` | "Better than X% of solves" |
| `fallback` | "Joined X others" |

### 3. Drop unused signal references

`isNewPath` stays in `CelebrationData` (read by `creative` case logic).
`userStats` removed from `CelebrationData` and the POST response — streak
data is no longer surfaced in the celebration. Saves a per-solve KV call.

### 4. Achievements: vocabulary only, not the storage model

The case names (`pioneer`, `champion`, `perfectionist`, `adept`, `creative`,
`fallback`) borrow achievement-style nouns to set up a future achievements
feature. But this PR only ships the vocabulary — the celebration case is
recomputed fresh from current `puzzleStats` every time the dialog opens.

A real achievements feature would need:

- The earned case persisted at solve time (otherwise `pioneer` flips to
  `fallback` once others solve it, and the user "loses" their badge)
- Possibly the data that justified it stored too (move count, total
  solves at time of earn) for later "X% rarity" display
- Stable rules — once earned, never lost (or with clear loss rules)

Out of scope here. The case-name choice just makes that follow-up easier.

## Non-goals

- Visual histogram / bar chart. We tried wording first; if the wording-only
  flow lands well, the viz isn't worth adding.
- Personal-best overlay ("New personal best!"). The player remembers their
  own previous solve; the comparison-context body is the more valuable
  signal.
- Hiding `minMoves` server-side / from network payloads.
- No-JS path celebration (separate concern — no-JS users go to
  `/solutions` directly).
