import type { Signal } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";

import { useDebouncedCallback } from "#/client/use-debounced-callback.ts";
import { useSolveStream } from "#/client/use-solve-stream.ts";
import {
  DifficultyBadge,
  type SolveState,
} from "#/components/difficulty-badge.tsx";
import { validateBoard } from "#/game/board.ts";
import type { Board, Puzzle } from "#/game/types.ts";

type EditorDifficultyBadgeProps = {
  puzzle: Signal<Puzzle>;
  className?: string;
};

/** Long enough that a board mid-edit isn't solved on every change. */
const DEBOUNCE_MS = 3000;

/**
 * The difficulty badge on the editor's board — the one place the move count
 * isn't known ahead of time, so it's solved for as you build. Hydrated only to
 * give the solve somewhere to run; the badge is the same component the fixed
 * routes render straight from the server.
 */
export function EditorDifficultyBadge(
  { puzzle, className }: EditorDifficultyBadgeProps,
) {
  const [minMoves, setMinMoves] = useState(puzzle.value.minMoves);
  const [solveState, setSolveState] = useState<SolveState | undefined>();

  const { start, cancel } = useSolveStream((event) => {
    if (event.type === "progress") {
      setSolveState({ type: "solving", depth: event.depth });
    } else if (event.type === "solution") {
      setMinMoves(event.moves.length);
      setSolveState(undefined);
    } else {
      setSolveState({ type: "error", message: event.message });
    }
  });

  const solveLater = useDebouncedCallback((board: Board) => {
    setSolveState({ type: "solving", depth: 0 });
    start(board);
  }, DEBOUNCE_MS);

  useEffect(() => {
    const { board, minMoves } = puzzle.value;

    cancel();
    solveLater.clear();
    setSolveState(undefined);
    setMinMoves(minMoves);

    // A draft that already carries a count came from a solve, not an edit.
    if (minMoves) return;

    // An empty canvas isn't a board that failed to solve.
    if (!board.pieces.length) return;

    try {
      validateBoard(board);
    } catch (err) {
      setSolveState({ type: "error", message: (err as Error).message });
      return;
    }

    solveLater(board);
  }, [puzzle.value.board, puzzle.value.minMoves]);

  return (
    <DifficultyBadge
      puzzle={{ ...puzzle.value, minMoves }}
      solveState={solveState}
      className={className}
    />
  );
}
