import { getMoveSlide, resolveMoves } from "#/game/board.ts";
import type { Board, Move, Piece, Position } from "#/game/types.ts";

/**
 * One move of a solution, as it actually travels: which kind of piece made it,
 * and the cells crossed — one leg per portal, so a teleport draws as two lines
 * rather than one cutting across the board.
 */
export type SolutionStep = {
  piece: Piece["type"];
  segments: Position[][];
};

/** A cell a solution comes to rest on, and the moves that end there. */
export type SolutionStop = Position & {
  piece: Piece["type"];
  moves: number[];
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
    });
    current = resolveMoves(current, [move]);
  }

  return steps;
}

/**
 * Where each move lands, one entry per cell: a piece coming back to a cell, or
 * another stopping on it, adds its number to the one already there.
 */
export function getSolutionStops(steps: SolutionStep[]): SolutionStop[] {
  const stops: SolutionStop[] = [];

  steps.forEach((step, index) => {
    const end = step.segments.at(-1)?.at(-1);
    if (!end) return;

    const stop = stops.find(({ x, y }) => x === end.x && y === end.y);
    if (stop) stop.moves.push(index + 1);
    else stops.push({ ...end, piece: step.piece, moves: [index + 1] });
  });

  return stops;
}
