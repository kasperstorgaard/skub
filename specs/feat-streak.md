# Spec: Streak counter and personal stats

## Goal

Add streak counter and personal stats to Skub. Compute streak on the fly from
existing data — no new KV writes.

## Streak algorithm

`game/streak.ts` — pure computation, no db imports:

- `computeUserStats(entries, solutions)` — returns
  `{ currentStreak, bestStreak, totalSolves, optimalSolves }`
- Streak logic:
  1. Takes available `PuzzleManifestEntry[]` sorted ascending by `number`
  2. Takes user solutions and builds a `Set<string>` of solved slugs
  3. **Current streak**: walk entries in reverse; count consecutive hits, stop at
     first gap. Grace period: today's entry is skipped if unsolved.
  4. **Best streak**: walk the full history ascending; track running length and
     record the maximum
- `optimalSolves`: count solutions where `moves.length === entry.minMoves`

I/O wrapper `getUserStats(userId)` lives in `db/stats.ts` — fetches entries and
solutions, delegates to `computeUserStats`.

## Celebration dialog (`islands/celebration-dialog.tsx`)

Unified `getCelebration()` function with ranked cases:

1. **first-solver** — first person to solve this puzzle
2. **first-optimal** — first optimal solution
3. **new-path** — a unique move sequence not seen before
4. **streak-milestone** — streak hits 5, 10, 25, 50, 100
5. **streak** — currentStreak > 1
6. **other-solvers** — default fallback

Returns `{ case, headline, body }`. Single `useMemo` in the component.

## Surfaces

### Front page (`routes/index.tsx`)

`StatsSummary` component in the side panel. Shows current streak / best streak,
total solves, and optimal solves with percentage. Only rendered when
`totalSolves > 0`.

### Profile page (`routes/profile/index.tsx`)

Same `StatsSummary` component below name/theme settings.

## Testing

### Unit tests (`game/streak_test.ts`)

13 tests for `computeUserStats`: currentStreak (5), bestStreak (3),
totalSolves (1), optimalSolves (3), full scenario (1).

### E2E — returning user flow (`e2e/returning-user-flow_test.ts`)

Extended: solve daily puzzle, check celebration, solve archive puzzle, assert
celebration body contains "streak".

### E2E — home stats integration (`routes/_e2e/home_test.ts`)

API-seeded test: seed 2 solutions for the latest available puzzles via
`addSolution()`, load home page, assert streak=2 and solves=2.

### E2E helpers

`solvePuzzle(slug)` extracted to `e2e/helpers.ts` — loads puzzle and returns
optimal moves. Used across 3 test files.

## POM updates

- `celebrationDialog.heading` — matches by heading level only (no text matcher)
- `celebrationDialog.body` — new `<p>` locator for content assertions
- `solutionDialog.submitName` — button text updated to "Claim your solve"
- `GotoOptions` type removed from all POMs, replaced with `Parameters<>`
- `HomePage.stat(label)` — locator for stats `<dd>` by `<dt>` label

## Files affected

| Area | Files |
|------|-------|
| Core logic | `game/streak.ts`, `game/streak_test.ts` |
| I/O wrapper | `db/stats.ts` |
| Celebration | `islands/celebration-dialog.tsx` |
| Front page | `routes/index.tsx`, `components/stats-summary.tsx` |
| Profile | `routes/profile/index.tsx` |
| Puzzle route | `routes/puzzles/[slug]/index.tsx` |
| E2E tests | `e2e/returning-user-flow_test.ts`, `routes/_e2e/home_test.ts` |
| E2E infra | `e2e/helpers.ts`, `routes/_e2e/home-page.ts`, `routes/puzzles/[slug]/_e2e/puzzle-page.ts`, `routes/puzzles/_e2e/archives-page.ts` |

## Out of scope

- Storing streak in KV (revisit if compute is slow)
- Per-puzzle personal history view
- Social / comparative streak features
- Streak notifications or reminders
