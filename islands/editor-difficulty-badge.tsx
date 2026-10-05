import type { Signal } from "@preact/signals";

import {
  DifficultyBadge,
  type SolveState,
} from "#/components/difficulty-badge.tsx";
import type { Puzzle } from "#/game/types.ts";

type EditorDifficultyBadgeProps = {
  puzzle: Signal<Puzzle>;
  solveState: Signal<SolveState | undefined>;
  className?: string;
};

/**
 * The difficulty badge on the editor's board, kept live as `EditorSolver`
 * solves the board. The badge is the same component the fixed routes render
 * straight from the server.
 */
export function EditorDifficultyBadge(
  { puzzle, solveState, className }: EditorDifficultyBadgeProps,
) {
  return (
    <DifficultyBadge
      puzzle={puzzle.value}
      solveState={solveState.value}
      className={className}
    />
  );
}
