import type { Signal } from "@preact/signals";
import { useEffect } from "preact/hooks";

import { useDebouncedCallback } from "#/client/use-debounced-callback.ts";
import { useSolveStream } from "#/client/use-solve-stream.ts";
import type { SolveState } from "#/components/difficulty-badge.tsx";
import { isReadyToSolve, validateBoard } from "#/game/board.ts";
import type { Puzzle } from "#/game/types.ts";

type EditorSolverProps = {
  puzzle: Signal<Puzzle>;
  solveState: Signal<SolveState | undefined>;
};

/** Long enough that a board mid-edit isn't solved on every change. */
const DEBOUNCE_MS = 2000;

/**
 * Solves the editor's board as it's built: a solution lands on the puzzle as
 * `minMoves`, progress and errors in `solveState`. No UI of its own.
 */
export function EditorSolver({ puzzle, solveState }: EditorSolverProps) {
  const { start, cancel } = useSolveStream((event) => {
    if (event.type === "queued") {
      solveState.value = { type: "waiting" };
    } else if (event.type === "progress") {
      solveState.value = { type: "solving", depth: event.depth };
    } else if (event.type === "solution") {
      puzzle.value = { ...puzzle.value, minMoves: event.moves.length };
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

    // A draft that already carries a count came from a solve, not an edit.
    if (minMoves) return;

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
    solveLater(board);
  }, [puzzle.value.board, puzzle.value.minMoves]);

  return null;
}
