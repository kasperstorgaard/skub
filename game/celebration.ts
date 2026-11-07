import type { Puzzle, PuzzleStats } from "#/game/types.ts";

/**
 * The kind of celebration to show after a solve. The headline (Perfect /
 * Solved) is computed separately at the call site.
 *
 * Precedence (top-down — first match wins):
 *   champion → pioneer → creative → fallback
 */
export type CelebrationType =
  | "champion"
  | "pioneer"
  | "creative"
  | "fallback";

/**
 * Picks the celebration type from the solve outcome + current aggregate
 * stats. Pure function — no strings, no UI. Renderers compute their own
 * counts from `puzzleStats`.
 */
export function getCelebrationType(
  moveCount: number,
  puzzle: Pick<Puzzle, "minMoves">,
  options: { puzzleStats: PuzzleStats; isNewPath: boolean },
): CelebrationType {
  const { puzzleStats, isNewPath } = options;
  const { totalSolutions, solutionsHistogram } = puzzleStats;

  const isPerfect = moveCount === puzzle.minMoves;
  if (isPerfect && (solutionsHistogram[moveCount] ?? 0) <= 1) {
    return "champion";
  }

  if (totalSolutions <= 1) return "pioneer";
  if (isNewPath) return "creative";

  return "fallback";
}
