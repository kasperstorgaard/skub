import { clsx } from "clsx/lite";

import type { Puzzle } from "#/game/types.ts";

type Props = {
  puzzle: Pick<Puzzle, "name" | "number">;
  className?: string;
};

/**
 * A page's puzzle title: the number on its own line above, smaller, light
 * and muted, like a card's lead, then the name. Cards put the number in their
 * lead instead (`PuzzleCard`).
 */
export function PuzzleName({ puzzle, className }: Props) {
  return (
    <span className={clsx("inline-flex flex-col", className)}>
      {puzzle.number && (
        <span className="text-3 font-3 leading-none text-text-2">
          #{puzzle.number}
        </span>
      )}
      <span className="type-title-lg leading-none">{puzzle.name}</span>
    </span>
  );
}
