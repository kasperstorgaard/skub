import { resolveMoves } from "#/game/board.ts";
import { solveSync } from "#/game/solver.ts";
import type { Move, Puzzle } from "#/game/types.ts";

/**
 * How many moves of an optimal solution Flash plays for you: 3 from 10 moves,
 * 2 from 8, 1 from 5, and none below that.
 */
export function getFlashStartLength(minMoves: number) {
  if (minMoves >= 10) return 3;
  if (minMoves >= 8) return 2;
  if (minMoves >= 5) return 1;
  return 0;
}

/**
 * The puzzle as Flash plays it: a shorter puzzle that starts after the Flash
 * start, which comes from an optimal solution, so the rest is optimal too.
 */
export function withFlashStart(puzzle: Puzzle, flashStart: Move[]): Puzzle {
  return {
    ...puzzle,
    board: resolveMoves(puzzle.board, flashStart),
    minMoves: puzzle.minMoves - flashStart.length,
  };
}

/**
 * Solves the puzzle for its Flash start, or `undefined` when it's too short for
 * Flash or too big for the solver. Run on promotion. Crowded boards are slow per
 * state (ulf, 28 blockers: ~20 s per 100k states) and can take a very long
 * time; give those a Flash start by hand instead.
 */
export function generateFlashStart(puzzle: Puzzle): Move[] | undefined {
  const length = getFlashStartLength(puzzle.minMoves);
  if (length === 0) return undefined;

  try {
    // No need to look past the known shortest solution.
    const solution = solveSync(puzzle, { maxDepth: puzzle.minMoves });
    return solution.slice(0, length);
  } catch {
    return undefined;
  }
}
