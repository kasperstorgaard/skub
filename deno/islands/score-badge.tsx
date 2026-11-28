import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";

import type { Puzzle } from "#/game/types.ts";
import { MoveScore } from "#/islands/move-score.tsx";

type ScoreBadgeProps = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  /** A fixed count instead of the URL's moves, see `MoveScore` */
  moves?: number | null;
  /** "–" for the target until the player has solved the puzzle. */
  hideMinMoves?: boolean;
  /** The player's best on the puzzle, in place of the shortest. */
  bestMoves?: number;
  className?: string;
};

/** While playing: moves played over your best, or the shortest. */
export function ScoreBadge(
  { puzzle, href, moves, hideMinMoves, bestMoves, className }: ScoreBadgeProps,
) {
  return (
    <span
      className={clsx(
        "difficulty-badge relative flex items-stretch overflow-hidden rounded-2",
        "leading-loose text-4 lg:text-3 tracking-wider",
        "bg-raised-1",
        className,
      )}
    >
      <span
        className={clsx(
          // 71px at the badge's 20px text, scaling with it
          "grid place-items-center px-2 min-w-[3.55em] text-center cursor-help",
          "bg-raised-2",
        )}
        title={bestMoves !== undefined
          ? "moves played / your best"
          : hideMinMoves
          ? "moves played / no solves yet"
          : "moves played / shortest possible path"}
      >
        <MoveScore
          href={href}
          moves={moves}
          minMoves={puzzle.value.minMoves}
          hideMinMoves={hideMinMoves}
          best={bestMoves}
        />
      </span>
    </span>
  );
}
