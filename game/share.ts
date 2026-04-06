import { getSolutionPercentile } from "#/game/stats.ts";
import { Puzzle, PuzzleStats } from "#/game/types.ts";

type ShareParams = {
  origin: string;
  puzzle: Pick<Puzzle, "slug" | "number" | "name" | "difficulty" | "minMoves">;
  moveCount: number;
  stats: PuzzleStats;
};

/**
 * Builds the share text snippet for a solved puzzle.
 * Returns { text, url } — pass separately to navigator.share,
 * or join with a newline for clipboard.
 */
export function getShareText(
  { origin, puzzle, moveCount, stats }: ShareParams,
): { text: string; url: string } {
  const url = `${origin}/puzzles/${puzzle.slug}`;
  const header = `Skub${puzzle.number ? ` #${puzzle.number}` : ""} ${puzzle.name} \u00b7 ${
    capitalize(puzzle.difficulty)
  }`;

  const { solutionsHistogram, totalSolutions } = stats;
  const isOptimal = moveCount === puzzle.minMoves;
  const isFirstOptimal = isOptimal && (solutionsHistogram[moveCount] ?? 0) <= 1;

  const percentileRounded = totalSolutions >= 10
    ? Math.round((100 - getSolutionPercentile(stats, moveCount)) / 5) * 5
    : null;

  let body: string;

  if (isFirstOptimal) {
    body = `First perfect solve \u00b7 ${moveCount} moves`;
  } else if (isOptimal) {
    const pctPart = percentileRounded != null
      ? ` \u00b7 top ${percentileRounded}%`
      : "";
    body = `Perfect \u00b7 ${moveCount} moves${pctPart}`;
  } else {
    const pctPart = percentileRounded != null
      ? ` \u00b7 top ${percentileRounded}%`
      : "";
    body = `Solved in ${moveCount} moves${pctPart}`;
  }

  return { text: `${header}\n${body}`, url };
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
