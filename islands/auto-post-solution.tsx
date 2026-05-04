import { type Signal } from "@preact/signals";
import { useEffect, useMemo, useRef } from "preact/hooks";

import { addTraceParentHeader } from "#/client/trace-context.ts";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import { Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";
import { useRouter } from "#/islands/router.tsx";

type Props = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  savedName: string;
  isSubmitting: Signal<boolean>;
  isNewPath: Signal<boolean>;
};

/**
 * Client-side auto-post: when a named user solves the puzzle via JS moves,
 * POST the solution and update href to include dialog=celebrate.
 * Renders nothing — purely a side-effect island.
 *
 * The shared `isSubmitting` signal flips true at POST start and false on
 * settle, letting the celebration dialog gate its visibility against the
 * network without staring at an empty board.
 */
export function AutoPostSolution(
  { href, puzzle, savedName, isSubmitting, isNewPath }: Props,
) {
  const { updateLocation } = useRouter();
  const postingRef = useRef(false);
  const celebratedRef = useRef(false);

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
    if (postingRef.current || celebratedRef.current) return;

    postingRef.current = true;
    isSubmitting.value = true;

    const form = new FormData();
    form.set("name", savedName);
    form.set("puzzleSlug", puzzle.value.slug);
    form.set("moves", JSON.stringify(moves));

    const headers = addTraceParentHeader(new Headers());

    // Intentionally not aborted on unmount — the solve must persist even if
    // the user navigates away mid-submission.
    fetch("/api/solutions", {
      method: "POST",
      headers,
      body: form,
    }).then(async (response) => {
      const data = await response.json() as { isNewPath: boolean };
      isNewPath.value = data.isNewPath;

      const celebrateUrl = new URL(href.value);
      celebrateUrl.searchParams.set("dialog", "celebrate");
      celebratedRef.current = true;
      updateLocation(celebrateUrl.href, { replace: true });
    }).catch(() => {
      // Silently fail — server path will handle it on next navigation
      postingRef.current = false;
    }).finally(() => {
      isSubmitting.value = false;
    });
  }, [isEnabled, state.moves, puzzle.value.slug]);

  return null;
}
