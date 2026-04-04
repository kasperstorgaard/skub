import { type Signal } from "@preact/signals";
import { useEffect, useMemo, useRef } from "preact/hooks";

import { isValidSolution, resolveMoves } from "#/game/board.ts";
import { Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";

type Props = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  savedName: string;
};

/**
 * Client-side auto-post: when a named user solves the puzzle via JS moves,
 * POST the solution and update href to include dialog=celebrate.
 * Renders nothing — purely a side-effect island.
 */
export function AutoPostSolution({ href, puzzle, savedName }: Props) {
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

  // TODO: expose a "submitting" state from the moment hasSolution becomes true
  // until href updates to ?dialog=celebrate, so the board or controls can show
  // a transition (e.g. disabled controls, subtle spinner) during the POST round trip
  // and the celebrate-stats fetch. Currently there is a silent gap between the last
  // move and the dialog appearing.

  useEffect(() => {
    if (!isEnabled) return;
    if (postingRef.current || celebratedRef.current) return;

    postingRef.current = true;

    const form = new FormData();
    form.set("name", savedName);
    form.set("moves", JSON.stringify(moves));

    fetch(`/puzzles/${puzzle.value.slug}`, {
      method: "POST",
      redirect: "follow",
      body: form,
    }).then((response) => {
      celebratedRef.current = true;
      href.value = response.url;
      globalThis.history.replaceState({}, "", response.url);
    }).catch(() => {
      // Silently fail — server path will handle it on next navigation
      postingRef.current = false;
    });
  }, [isEnabled, state.moves, puzzle.value.slug]);

  return null;
}
