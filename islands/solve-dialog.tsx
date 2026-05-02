import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

import { Dialog } from "./dialog.tsx";
import { useDelayedValue } from "#/client/use-delayed-value.ts";
import { useSolveStream } from "#/client/use-solve-stream.ts";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import { encodeMoves } from "#/game/strings.ts";
import { Move, Puzzle } from "#/game/types.ts";
import { decodeState, encodeState } from "#/game/url.ts";
import { useRouter } from "#/islands/router.tsx";

type Props = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
};

type SolveState = {
  status: "starting";
} | {
  status: "solving";
  depth: number;
} | {
  status: "done";
  moves: Move[];
} | {
  status: "error";
};

export function SolveDialog({ puzzle, href }: Props) {
  const gameState = useMemo(() => decodeState(href.value), [href.value]);

  const [solveState, setSolveState] = useState<SolveState | null>(null);

  const onLocationUpdated = useCallback((url: URL) => {
    href.value = url.href;
  }, []);

  const { updateLocation } = useRouter({ onLocationUpdated });

  const open = useMemo(() => {
    const url = new URL(href.value);
    return url.searchParams.get("dialog") === "solve";
  }, [href.value]);

  const moves = useMemo(
    () => gameState.moves.slice(0, gameState.cursor ?? gameState.moves.length),
    [gameState.moves, gameState.cursor],
  );

  const board = useMemo(
    () => resolveMoves(puzzle.value.board, moves),
    [puzzle.value.board, moves],
  );

  const totalMoves = useMemo(() => {
    if (solveState?.status !== "done") return 0;
    return moves.length + solveState.moves.length;
  }, [moves.length, solveState]);

  useEffect(() => {
    if (solveState?.status !== "done") return;

    const url = new URL(href.value);
    url.searchParams.set("moves", encodeMoves(solveState.moves));
    url.searchParams.set("cursor", (gameState.cursor ?? 0).toString());
    updateLocation(url.href);
  }, [solveState]);

  const closeModal = () => {
    const url = new URL(href.value);
    url.search = encodeState({ ...gameState, hint: undefined });
    updateLocation(url.href);
  };

  const { start: startSolve, cancel: cancelSolve } = useSolveStream((event) => {
    if (event.type === "progress") {
      setSolveState({ status: "solving", depth: event.depth });
    } else if (event.type === "solution") {
      setSolveState({ status: "done", moves: event.moves });
    } else if (event.type === "error") {
      setSolveState({ status: "error" });
    }
  });

  useEffect(() => {
    if (!open) {
      cancelSolve();
      setSolveState(null);
      return;
    }

    if (isValidSolution(board)) {
      setSolveState({ status: "done", moves: [] });
      return;
    }

    setSolveState({ status: "starting" });
    startSolve(board);

    return cancelSolve;
  }, [open]);

  return (
    <Dialog open={open} className="w-sm!">
      <div class="flex flex-col gap-fl-2 text-text-2">
        {solveState?.status === "starting" && (
          <>
            <h2 class="text-4 text-text-1 font-semibold leading-tight">
              Warming up the solver…
            </h2>

            <p class="leading-snug">
              Crunching your moves…
            </p>

            <div class="flex items-center gap-fl-2 mt-fl-1">
              <button
                type="button"
                className="link p-0 bg-transparent"
                disabled={!open}
                onClick={closeModal}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {solveState?.status === "solving" && (
          <>
            <p class="text-4 text-text-1 font-semibold leading-tight">
              Finding the shortest path…
            </p>

            <span class={clsx("leading-snug", "animate-blink")}>
              Trying all {solveState.depth}-move paths from here…
            </span>

            <div class="flex items-center gap-fl-2 mt-fl-1">
              <button
                type="button"
                className="link p-0 bg-transparent"
                disabled={!open}
                onClick={closeModal}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {solveState?.status === "done" && (
          <>
            <h2 class="text-4 leading-tight text-text-1">
              Found it - {totalMoves} {totalMoves === 1 ? "move" : "moves"}{" "}
              total
            </h2>

            <p class="leading-snug">
              Use the control panel undo/redo to see it
            </p>

            <div class="flex items-center gap-fl-2 mt-fl-1">
              <button
                type="button"
                className="btn"
                disabled={!open}
                onClick={closeModal}
              >
                Got it
              </button>
            </div>
          </>
        )}

        {solveState?.status === "error" && (
          <>
            <h2 class="text-4 text-text-1 font-semibold leading-tight">
              Something went wrong
            </h2>

            <p class="leading-snug">
              The solver couldn't find a solution. Try again later.
            </p>

            <div class="flex items-center gap-fl-2 mt-fl-1">
              <button
                type="button"
                className="btn"
                disabled={!open}
                onClick={closeModal}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
