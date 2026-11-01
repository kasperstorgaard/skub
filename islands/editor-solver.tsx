import type { Signal } from "@preact/signals";
import { useEffect } from "preact/hooks";

import { useDebouncedCallback } from "#/client/use-debounced-callback.ts";
import { useSolveStream } from "#/client/use-solve-stream.ts";
import { isReadyToSolve, validateBoard } from "#/game/board.ts";
import type { SolveState } from "#/game/solver.ts";
import type { Board, Move, Puzzle } from "#/game/types.ts";

/** A solution, and the exact board it was solved for. */
export type EditorSolution = { board: Board; moves: Move[] };

type EditorSolverProps = {
  puzzle: Signal<Puzzle>;
  solveState: Signal<SolveState | undefined>;
  /** The last solution found, kept for drawing on the board. */
  solution?: Signal<EditorSolution | null>;
};

/** Long enough that a board mid-edit isn't solved on every change. */
const DEBOUNCE_MS = 2000;

/**
 * Solves the editor's board as it's built: a solution lands on the puzzle as
 * `minMoves` and in `solution`, progress and errors in `solveState`. No UI of
 * its own.
 */
export function EditorSolver(
  { puzzle, solveState, solution }: EditorSolverProps,
) {
  const { start, cancel } = useSolveStream((event) => {
    if (event.type === "queued") {
      solveState.value = { type: "waiting" };
    } else if (event.type === "progress") {
      solveState.value = { type: "solving", depth: event.depth };
    } else if (event.type === "solution") {
      // Any edit cancels the solve in flight, so this is the board on screen.
      if (solution) {
        solution.value = { board: puzzle.value.board, moves: event.moves };
      }
      if (puzzle.value.minMoves !== event.moves.length) {
        puzzle.value = { ...puzzle.value, minMoves: event.moves.length };
      }
      solveState.value = undefined;
    } else {
      solveState.value = {
        type: "error",
        reason: event.reason,
        message: event.message,
      };
    }
  });

  const solveLater = useDebouncedCallback(start, DEBOUNCE_MS);

  useEffect(() => {
    const { board, minMoves } = puzzle.value;

    cancel();
    solveLater.clear();
    solveState.value = undefined;

    // A draft that already carries a count came from a solve, not an edit —
    // but it arrives without its moves, so those are fetched for the overlay.
    const hasMoves = !solution || solution.value?.board === board;
    if (minMoves && hasMoves) return;

    // No puck or destination yet: unfinished, not an error.
    if (!isReadyToSolve(board)) return;

    try {
      validateBoard(board);
    } catch (err) {
      solveState.value = {
        type: "error",
        reason: "invalid",
        message: (err as Error).message,
      };
      return;
    }

    solveState.value = { type: "waiting" };

    // Nothing is mid-edit when only the moves are missing, so no need to wait.
    if (minMoves) start(board);
    else solveLater(board);
  }, [puzzle.value.board, puzzle.value.minMoves]);

  return null;
}
