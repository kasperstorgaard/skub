import type { Signal } from "@preact/signals";

import { decodeState } from "#/game/url.ts";

type MoveScoreProps = {
  href: Signal<string>;
  /** A fixed count instead of the URL's, e.g. a best solve; null for none */
  moves?: number | null;
  minMoves?: number;
  /** Show "?" for the shortest solution until the puzzle is solved. */
  hideMinMoves?: boolean;
};

/** Moves played over the shortest solution, e.g. "3/10" or "3/?". */
export function MoveScore(
  { href, moves, minMoves, hideMinMoves }: MoveScoreProps,
) {
  const state = decodeState(href.value);
  const count = moves === undefined
    ? Math.min(state.moves.length, state.cursor ?? 0)
    : moves ?? "–";

  return (
    <span className="tabular-nums tracking-widest">
      {count}
      <span className="mx-[0.1em]">/</span>
      {hideMinMoves ? <span className="opacity-50">?</span> : minMoves || "—"}
    </span>
  );
}
