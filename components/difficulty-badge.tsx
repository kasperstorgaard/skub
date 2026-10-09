import { clsx } from "clsx/lite";

import { Icon, Warning } from "#/components/icons.tsx";
import type { SolverErrorReason } from "#/game/solver.ts";
import type { Puzzle } from "#/game/types.ts";

/** Where a board being edited is in its solve; a fixed puzzle has no state. */
export type SolveState =
  | { type: "waiting" }
  | { type: "solving"; depth: number }
  | { type: "error"; reason: SolverErrorReason; message: string };

type DifficultyBadgeProps = {
  puzzle: Puzzle;
  /** Hide the move count when the user hasn't solved this puzzle before. */
  hideMinMoves?: boolean;
  /** Set while the editor solves the board on screen. */
  solveState?: SolveState;
  className?: string;
};

/**
 * Difficulty label plus the shortest solution's length. A finished puzzle gets
 * its count from `update-puzzles`; a board still on the editor's canvas gets one
 * from `solveState`.
 */
export function DifficultyBadge(
  { puzzle, hideMinMoves, solveState, className }: DifficultyBadgeProps,
) {
  const error = getSolveError(solveState);
  const unsolved = isUnsolved(solveState);
  const busy = isSolveBusy(solveState);

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
          solveState && "text-text-2",
          busy && "tabular-nums animate-blink",
        )}
        title={getSolveTitle(solveState) ??
          (hideMinMoves
            ? "solve the puzzle to reveal"
            : "shortest possible solution")}
      >
        {error && <Icon icon={Warning} />}
        {unsolved && "?"}
        {busy && (getSolveDepth(solveState) || "…")}
        {!solveState && (hideMinMoves ? "?" : puzzle.minMoves || "—")}
      </span>
    </span>
  );
}

/** Invalid boards and broken solves, as opposed to an unknown count. */
function getSolveError(solveState?: SolveState) {
  if (solveState?.type !== "error" || isUnsolved(solveState)) return null;
  return solveState.message;
}

/** Gave up on budget or ruled out: the board is fine, the count is unknown. */
function isUnsolved(solveState?: SolveState) {
  return solveState?.type === "error" &&
    (solveState.reason === "budget" || solveState.reason === "unsolvable");
}

/** Waiting on the debounce or the server, or searching. */
function isSolveBusy(solveState?: SolveState) {
  return solveState?.type === "waiting" || solveState?.type === "solving";
}

function getSolveDepth(solveState?: SolveState) {
  return solveState?.type === "solving" ? solveState.depth : 0;
}

function getSolveTitle(solveState?: SolveState) {
  switch (solveState?.type) {
    case "waiting":
      return "waiting to solve";
    case "solving":
      return `searching depth ${solveState.depth}`;
    case "error":
      return solveState.message;
  }
}
