import { type Signal } from "@preact/signals";
import { useEffect, useMemo, useRef } from "preact/hooks";

import { addTraceParentHeader } from "#/client/trace-context.ts";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import { Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";
import type { CelebrationData } from "#/islands/celebration-dialog.tsx";
import { useRouter } from "#/islands/router.tsx";

type Props = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  savedName: string;
  celebrationData?: Signal<CelebrationData | null>;
  celebrationError?: Signal<boolean>;
};

/**
 * Client-side auto-post: when a named user solves the puzzle via JS moves,
 * POST the solution as JSON. If the server responds with celebration data,
 * write it to the signal. If the server redirects (e.g. tutorial flow),
 * navigate to the redirected URL. Renders nothing.
 */
export function AutoPostSolution(
  { href, puzzle, savedName, celebrationData, celebrationError }: Props,
) {
  const { updateLocation } = useRouter();
  const postingRef = useRef(false);
  const completedRef = useRef(false);

  const state = useMemo(() => decodeState(href.value), [href.value]);

  const dialog = useMemo(
    () => new URL(href.value).searchParams.get("dialog"),
    [href.value],
  );

  const moves = useMemo(
    () => state.moves.slice(0, state.cursor ?? state.moves.length),
    [state.moves, state.cursor],
  );

  const board = useMemo(() => resolveMoves(puzzle.value.board, moves), [
    puzzle.value.board,
    moves,
  ]);

  const hasSolution = useMemo(() => isValidSolution(board), [board]);

  const isEnabled = hasSolution && !!savedName && !dialog;

  useEffect(() => {
    if (!isEnabled) return;
    if (postingRef.current || completedRef.current) return;

    postingRef.current = true;

    const headers = addTraceParentHeader(
      new Headers({
        "Content-Type": "application/json",
        "Accept": "application/json",
      }),
    );

    // Intentionally not aborted on unmount — the solve must persist even if
    // the user navigates away mid-submission.
    fetch(href.value, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: savedName, moves }),
    }).then(async (response) => {
      completedRef.current = true;

      if (response.redirected) {
        updateLocation(response.url, { replace: true });
        return;
      }

      if (celebrationData) {
        const data = await response.json() as CelebrationData;
        celebrationData.value = data;
      }
    }).catch(() => {
      postingRef.current = false;
      if (celebrationError) celebrationError.value = true;
    });
  }, [isEnabled, state.moves, puzzle.value.slug]);

  return null;
}
