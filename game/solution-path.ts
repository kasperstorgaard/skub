import { getMoveSlide, resolveMoves, type SlideOutcome } from "#/game/board.ts";
import type { Board, Move, Piece, Position } from "#/game/types.ts";

/**
 * One move of a solution, as it actually travels: which kind of piece made it,
 * and the cells crossed — one leg per portal, so a teleport draws as two lines
 * rather than one cutting across the board.
 */
export type SolutionStep = {
  piece: Piece["type"];
  segments: Position[][];
  outcome: SlideOutcome;
};

/**
 * Replays `moves` on `board`, describing each one for drawing. Stops at the
 * first move that doesn't fit the board, so a solution solved for an older
 * version of the board draws as far as it still holds rather than throwing.
 */
export function getSolutionSteps(board: Board, moves: Move[]): SolutionStep[] {
  const steps: SolutionStep[] = [];
  let current = board;

  for (const move of moves) {
    const slide = getMoveSlide(move, current);
    const piece = current.pieces.find((p) =>
      p.x === move[0].x && p.y === move[0].y
    );
    if (!slide || !piece) break;

    steps.push({
      piece: piece.type,
      segments: slide.segments,
      outcome: slide.outcome,
    });
    current = resolveMoves(current, [move]);
  }

  return steps;
}
