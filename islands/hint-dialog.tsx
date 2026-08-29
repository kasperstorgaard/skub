import type { Signal } from "@preact/signals";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

import { Dialog } from "./dialog.tsx";
import { hintUsed } from "#/client/hint-signals.ts";
import { ArrowCounterClockwise, Icon } from "#/components/icons.tsx";
import { decodeMove, encodeMove } from "#/game/strings.ts";
import { Move, Puzzle } from "#/game/types.ts";
import {
  decodeState,
  encodeState,
  getHintHref,
  getResetHref,
} from "#/game/url.ts";
import { useRouter } from "#/islands/router.tsx";

// How long the searching state holds. The server answers in well under this,
// so it's reading time for a state that would otherwise flash past. Coupled to
// the searching copy, which is written for a pause this long — change both or
// neither. Goes when hints become time-based assistance and show instantly.
const MIN_THINK_MS = 3000;

type Props = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  /** Hide the optimal move count when the user hasn't solved this puzzle before. */
  hideMinMoves?: boolean;
};

type SolveState = {
  status: "solving";
} | {
  status: "done";
  hint: Move;
  remaining: number;
} | {
  status: "error";
};

export function HintDialog({ puzzle, href, hideMinMoves }: Props) {
  const gameState = useMemo(() => decodeState(href.value), [href.value]);
  const minMoves = puzzle.value.minMoves;
  const [fetched, setFetched] = useState<SolveState | null>(null);

  const onLocationUpdated = useCallback((url: URL) => {
    href.value = url.href;
  }, []);

  const { updateLocation } = useRouter({ onLocationUpdated });

  const open = useMemo(() => {
    const url = new URL(href.value);
    return url.searchParams.get("dialog") === "hint";
  }, [href.value]);

  // The hint route's answer, carried in the URL by its redirect. Derived during
  // render because effects don't run without JS, where this is the only state
  // the dialog has.
  const served = useMemo((): SolveState | null => {
    const remaining = Number(new URL(href.value).searchParams.get("remaining"));
    return gameState.hint && remaining > 0
      ? { status: "done", hint: gameState.hint, remaining }
      : null;
  }, [href.value, gameState.hint]);

  const solveState = fetched ?? served;

  const moves = useMemo(
    () => gameState.moves.slice(0, gameState.cursor ?? gameState.moves.length),
    [
      gameState.moves,
      gameState.cursor,
    ],
  );

  const remainingMoves = useMemo(
    () => solveState?.status === "done" ? solveState.remaining : 0,
    [solveState],
  );

  const resetHref = useMemo(() => {
    const url = new URL(href.value);
    url.searchParams.delete("dialog");
    return getResetHref(url.href);
  }, [href.value]);

  const totalMoves = useMemo(
    () => moves.length + remainingMoves,
    [gameState, remainingMoves],
  );

  // If you are 1 off from a perfect solution, you are considered off track
  // TODO: consider how much is needed for "off-track" really
  const offTrack = useMemo(() => {
    return solveState?.status === "done" &&
      totalMoves > minMoves + 2;
  }, [solveState, minMoves, remainingMoves]);

  // Closing just clears the dialog: encodeState rebuilds the params from
  // scratch, dropping `dialog` and `remaining` while keeping the hint. Exposed
  // as an href too, so the dismiss controls are links that still work with no
  // JS to intercept them.
  const closeHref = useMemo(() => {
    const url = new URL(href.value);
    const hint = solveState?.status === "done"
      ? solveState.hint
      : gameState.hint;
    url.search = encodeState({ ...gameState, hint });
    return url.href;
  }, [href.value, gameState, solveState]);

  const closeModal = () => updateLocation(closeHref);

  // Highlight the move as soon as it lands, so the board updates behind the
  // open dialog. Replaces rather than pushes — the hint isn't a step worth
  // walking back through.
  useEffect(() => {
    if (solveState?.status !== "done") return;

    const url = new URL(href.value);
    const hint = encodeMove(solveState.hint);
    if (url.searchParams.get("hint") === hint) return;

    url.searchParams.set("hint", hint);
    updateLocation(url.href, { replace: true });
  }, [solveState]);

  // React to ?dialog=hint appearing in the URL. The hint route is the only
  // source of a solution; this asks it for JSON instead of following its
  // redirect, so the dialog can open before the answer arrives.
  useEffect(() => {
    if (!open) {
      setFetched(null);
      return;
    }

    // Already answered by the route's redirect — `served` covers the render.
    if (served) return;

    const controller = new AbortController();
    setFetched({ status: "solving" });

    const minThink = new Promise<void>((resolve) =>
      setTimeout(resolve, MIN_THINK_MS)
    );

    fetch(getHintHref(href.value), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) =>
        response.ok ? response.json() : Promise.reject(response.status)
      )
      .then(async (data: { hint: string; remaining: number }) => {
        await minThink;
        if (controller.signal.aborted) return;
        hintUsed.value = true;
        setFetched({
          status: "done",
          hint: decodeMove(data.hint),
          remaining: data.remaining,
        });
      })
      .catch((status: unknown) => {
        if (controller.signal.aborted) return;
        // A 400 is the spent allowance. Either way no hint is coming, so the
        // button should retire.
        if (status === 400) hintUsed.value = true;
        setFetched({ status: "error" });
      });

    return () => controller.abort();
  }, [open]);

  return (
    <Dialog open={open}>
      <div class="flex flex-col gap-fl-2 text-text-2">
        {solveState?.status === "solving" && (
          <>
            <h2 class="text-4 text-text-1 font-semibold leading-tight">
              Finding the shortest path…
            </h2>

            <span class="leading-snug">
              Crunching the possibilities<span class="loading-dots ml-[0.2ch]">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
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

        {solveState?.status === "done" && offTrack && (
          <>
            <h2 class="text-4 text-text-1 font-semibold leading-tight">
              You've gone a bit off track
            </h2>

            <p className="leading-snug">
              {hideMinMoves
                ? "You can still solve the puzzle, but there are much shorter paths."
                : `You can still solve the puzzle, but you'll need ${totalMoves} moves total (optimal is ${minMoves})`}
            </p>

            <p className="leading-snug">
              The next move is highlighted on the board
            </p>

            <div class="flex items-center gap-fl-2 mt-fl-1">
              <a href={resetHref} class="btn">
                <Icon icon={ArrowCounterClockwise} />
                Start over
              </a>

              <a
                href={closeHref}
                className="link p-0 bg-transparent"
                onClick={(event) => {
                  event.preventDefault();
                  closeModal();
                }}
              >
                Keep going
              </a>
            </div>
          </>
        )}

        {solveState?.status === "done" && !offTrack && (
          <>
            <h2 className="text-4 leading-tight text-text-1">
              Found it — {hideMinMoves
                ? remainingMoves <= 2 ? "almost there" : "some way to go"
                : `${remainingMoves} ${
                  remainingMoves === 1 ? "move" : "moves"
                } to go`}
            </h2>

            <p className="leading-snug">
              The first move is highlighted, the rest is on you
            </p>

            <div class="flex items-center gap-fl-2 mt-fl-1">
              <a
                href={closeHref}
                className="btn"
                onClick={(event) => {
                  event.preventDefault();
                  closeModal();
                }}
              >
                Got it
              </a>
            </div>
          </>
        )}

        {solveState?.status === "error" && (
          <>
            <h2 class="text-4 text-text-1 font-semibold leading-tight">
              No hint this time
            </h2>

            <p>
              Couldn't get a hint right now.
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
