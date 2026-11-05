import type { Signal } from "@preact/signals";

import { decodeState } from "#/game/url.ts";

type MoveScoreProps = {
  href: Signal<string>;
  minMoves?: number;
  /** Show "?" for the shortest solution until the puzzle is solved. */
  hideMinMoves?: boolean;
};

/** Moves played over the shortest solution, e.g. "3/10" or "3/?". */
export function MoveScore({ href, minMoves, hideMinMoves }: MoveScoreProps) {
  const { moves, cursor } = decodeState(href.value);
  const count = Math.min(moves.length, cursor ?? 0);

  return (
    <span className="tabular-nums tracking-widest">
      {count}
      <span className="mx-[0.1em]">/</span>
      {hideMinMoves ? <span className="opacity-50">?</span> : minMoves || "—"}
    </span>
  );
}
