import { clsx } from "clsx/lite";

import type { Puzzle } from "#/game/types.ts";

type DifficultyBadgeProps = {
  puzzle: Puzzle;
  /** Hide the move count when the user hasn't solved this puzzle before. */
  hideMinMoves?: boolean;
  className?: string;
};

/**
 * Difficulty label plus the shortest solution's length, both "?" until they're
 * known. A puzzle still being built gets its count from `update-puzzles`.
 */
export function DifficultyBadge(
  { puzzle, hideMinMoves, className }: DifficultyBadgeProps,
) {
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
        title="puzzle difficulty"
      >
        {puzzle.difficulty ?? "unknown"}
      </span>

      <span
        className={clsx(
          "px-2 bg-surface-3 min-w-[3ch] text-center",
          "cursor-help",
        )}
        title={hideMinMoves
          ? "solve the puzzle to reveal"
          : "shortest possible solution"}
      >
        {hideMinMoves ? "?" : puzzle.minMoves || "?"}
      </span>
    </span>
  );
}
