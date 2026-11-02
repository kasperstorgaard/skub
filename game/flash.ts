import { resolveMoves } from "#/game/board.ts";
import type { Move, Puzzle } from "#/game/types.ts";

/**
 * How many moves of an optimal solution Flash plays for you: 3 from 10 moves,
 * 2 from 8, 1 from 5, and none below that.
 */
export function getHeadStartLength(minMoves: number) {
  if (minMoves >= 10) return 3;
  if (minMoves >= 8) return 2;
  if (minMoves >= 5) return 1;
  return 0;
}

/** The head start from a solution: its first moves, as many as the puzzle allows. */
export function getHeadStart(solution: Move[], minMoves: number) {
  return solution.slice(0, getHeadStartLength(minMoves));
}

/**
 * The puzzle as Flash plays it: a shorter puzzle that starts after the head
 * start, which comes from an optimal solution, so the rest is optimal too.
 */
export function withHeadStart(puzzle: Puzzle, headStart: Move[]): Puzzle {
  return {
    ...puzzle,
    board: resolveMoves(puzzle.board, headStart),
    minMoves: puzzle.minMoves - headStart.length,
  };
}
