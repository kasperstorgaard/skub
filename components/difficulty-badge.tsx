import { clsx } from "clsx/lite";

import { Icon, Warning } from "#/components/icons.tsx";
import type { Puzzle } from "#/game/types.ts";

/** Where a board being edited is in its solve; a fixed puzzle has no state. */
export type SolveState =
  | { type: "solving"; depth: number }
  | { type: "error"; message: string };

type DifficultyBadgeProps = {
  puzzle: Puzzle;
  /** Hide the move count when the user hasn't solved this puzzle before. */
  hideMinMoves?: boolean;
  /** Set while the editor solves the board on screen. */
  solveState?: SolveState;
  className?: string;
};

/**
 * Difficulty label plus the shortest solution's length, both "?" until they're
 * known. A finished puzzle gets its count from `update-puzzles`; a board still
 * on the editor's canvas gets one from `solveState`.
 */
export function DifficultyBadge(
  { puzzle, hideMinMoves, solveState, className }: DifficultyBadgeProps,
) {
  const error = solveState?.type === "error" ? solveState.message : null;
  const depth = solveState?.type === "solving" ? solveState.depth : null;

  return (
    <span
      className={clsx(
        "flex items-center pl-1 leading-loose justify-center text-2",
        "bg-surface-2 cursor-help tracking-wider",
        className,
      )}
    >
      <span
        className="text-center px-2 uppercase cursor-help"
        title={error ?? "puzzle difficulty"}
      >
        {error ? "error" : puzzle.difficulty ?? "unknown"}
      </span>

      <span
        className={clsx(
          "px-2 bg-surface-3 min-w-[3ch] text-center cursor-help",
          (error || depth !== null) && "text-text-2",
          depth !== null && "tabular-nums animate-blink",
        )}
        title={error ??
          (depth !== null
            ? `searching depth ${depth}`
            : hideMinMoves
            ? "solve the puzzle to reveal"
            : "shortest possible solution")}
      >
        {error
          ? <Icon icon={Warning} />
          : depth !== null
          ? depth || "?"
          : hideMinMoves
          ? "?"
          : puzzle.minMoves || "?"}
      </span>
    </span>
  );
}
