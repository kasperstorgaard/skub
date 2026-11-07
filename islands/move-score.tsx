import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";

import { decodeState } from "#/game/url.ts";

type MoveScoreProps = {
  href: Signal<string>;
  /** A fixed count instead of the URL's, e.g. a best solve; null for none */
  moves?: number | null;
  minMoves?: number;
  /** Show "–" for the target until the puzzle is solved: no solves yet. */
  hideMinMoves?: boolean;
  /** The player's best, in place of the shortest. */
  best?: number;
  /** Just the count, with nothing to measure it against */
  hideTarget?: boolean;
};

/** Moves played over the player's best or the shortest, e.g. "3/10" or "3/–". */
export function MoveScore(
  { href, moves, minMoves, hideMinMoves, best, hideTarget }: MoveScoreProps,
) {
  const state = decodeState(href.value);
  const count = moves === undefined
    ? Math.min(state.moves.length, state.cursor ?? 0)
    : moves ?? "–";
  // A best at the shortest is the puck's colour, like the stars.
  const isPerfect = best !== undefined && minMoves !== undefined &&
    best <= minMoves;

  if (hideTarget) {
    return <span className="tabular-nums tracking-widest">{count}</span>;
  }

  return (
    <span className="tabular-nums tracking-widest">
      {count}
      <span className="mx-[0.1em]">/</span>
      {/* The player's count leads; the target sits back */}
      <span className={clsx(isPerfect ? "text-ui-2" : "opacity-50")}>
        {hideMinMoves ? "–" : best ?? (minMoves || "—")}
      </span>
    </span>
  );
}
