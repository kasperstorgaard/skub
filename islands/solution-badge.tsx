import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";

import { Icon, Warning } from "#/components/icons.tsx";
import { KeyHint } from "#/components/key-hint.tsx";
import type { SolveState } from "#/game/solver.ts";
import type { Puzzle } from "#/game/types.ts";
import { EditorSolutionToggle } from "#/islands/editor-solution-toggle.tsx";

type SolutionBadgeProps = {
  puzzle: Signal<Puzzle>;
  solveState: Signal<SolveState | undefined>;
  /** The count doubles as this switch. */
  showSolution: Signal<boolean>;
  className?: string;
};

/**
 * The editor's take on `DifficultyBadge`: the shortest solution's length, kept
 * live as `EditorSolver` solves the board, as part of the overlay switch.
 */
export function SolutionBadge(
  { puzzle, solveState, showSolution, className }: SolutionBadgeProps,
) {
  const state = solveState.value;
  const error = getSolveError(state);
  const unsolved = isUnsolved(state);
  const busy = isSolveBusy(state);

  const count = (
    <span
      className={clsx(
        "flex items-center justify-center size-full",
        busy && "tabular-nums animate-blink",
      )}
      title={getSolveTitle(state) ?? "shortest possible solution"}
    >
      {error && <Icon icon={Warning} />}
      {unsolved && "∅"}
      {busy && (getSolveDepth(state) || "…")}
      {!state && (puzzle.value.minMoves || "—")}
    </span>
  );

  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      <KeyHint above>Shift</KeyHint>

      <span
        className={clsx(
          "difficulty-badge flex items-stretch overflow-hidden leading-loose",
          "border-2 border-link rounded-2 text-2 tracking-wider",
        )}
      >
        <EditorSolutionToggle showSolution={showSolution}>
          {count}
        </EditorSolutionToggle>
      </span>
    </div>
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
