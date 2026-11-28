import { clsx } from "clsx/lite";

import type { Puzzle } from "#/game/types.ts";

type Props = {
  puzzle: Pick<Puzzle, "name" | "number">;
  /** What the page shows of the puzzle, in place of the number */
  lead?: string;
  className?: string;
};

/**
 * A page's puzzle title: the number, or the page's lead in its place, on its
 * own line above, three sizes down and muted, like a card's lead.
 */
export function PuzzleName({ puzzle, lead, className }: Props) {
  return (
    <span className={clsx("inline-flex flex-col", className)}>
      {/* A ternary, not &&: the preview's number is 0, which would print */}
      {lead || puzzle.number
        ? (
          <span className="text-3 [font-weight:300] leading-none text-text-2">
            {lead ?? `#${puzzle.number}`}
          </span>
        )
        : null}
      <span className="type-title-lg font-5 leading-none">{puzzle.name}</span>
    </span>
  );
}
