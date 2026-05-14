import type { Puzzle, PuzzleStats } from "#/game/types.ts";

/**
 * The kind of celebration to show after a solve. Headline closeness
 * (Perfect / Great / Solved) is computed separately at the call site.
 *
 * Precedence (top-down — first match wins):
 *   champion → perfectionist → pioneer → creative → adept → fallback
 */
export type CelebrationType =
  | "champion"
  | "perfectionist"
  | "pioneer"
  | "creative"
  | "adept"
  | "fallback";

/**
 * Picks the celebration type from the solve outcome + current aggregate
 * stats. Pure function — no strings, no UI. Renderers compute their own
 * pct/count from `puzzleStats` + `moveCount`.
 */
export function getCelebrationType(
  moveCount: number,
  puzzle: Pick<Puzzle, "minMoves">,
  options: { puzzleStats: PuzzleStats; isNewPath: boolean },
): CelebrationType {
  const { puzzleStats, isNewPath } = options;
  const { totalSolutions, solutionsHistogram } = puzzleStats;
  const isPerfect = moveCount === puzzle.minMoves;

  if (isPerfect) {
    const perfectsCount = solutionsHistogram[moveCount] ?? 0;
    if (perfectsCount <= 1) return "champion";
    return "perfectionist";
  }

  if (totalSolutions <= 1) return "pioneer";
  if (isNewPath) return "creative";

  const slowerSolves = countSolvesAbove(solutionsHistogram, moveCount);
  if (totalSolutions >= 10 && slowerSolves / totalSolutions >= 0.4) {
    return "adept";
  }

  return "fallback";
}

/** Sums histogram entries strictly above `moveCount` (i.e. solves that took more moves). */
export function countSolvesAbove(
  histogram: Record<number, number>,
  moveCount: number,
): number {
  let total = 0;
  for (const [count, n] of Object.entries(histogram)) {
    if (Number(count) > moveCount) total += n;
  }
  return total;
}
