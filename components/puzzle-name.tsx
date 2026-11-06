import { clsx } from "clsx/lite";

import type { Puzzle } from "#/game/types.ts";

type Props = {
  puzzle: Pick<Puzzle, "name" | "number">;
  /** lg: page titles, md: cards */
  size?: "lg" | "md";
  /** lg only: what the page is about the puzzle, after the number */
  lead?: preact.ComponentChildren;
  className?: string;
};

/**
 * A puzzle's number and name as one title. Page titles (lg) put the number
 * and any lead on their own line above, three sizes down and muted, like a
 * card's lead; cards (md) keep the number on the name's baseline.
 */
export function PuzzleName(
  { puzzle, size = "md", lead, className }: Props,
) {
  if (size === "lg") {
    return (
      <span className={clsx("inline-flex flex-col", className)}>
        {(puzzle.number || lead) && (
          <span className="text-3 [font-weight:300] leading-none text-text-2">
            {puzzle.number && `#${puzzle.number}`}
            {puzzle.number && lead && " · "}
            {lead}
          </span>
        )}
        <span className="type-title-lg [font-weight:500] leading-none">
          {puzzle.name}
        </span>
      </span>
    );
  }

  return (
    <span className={clsx("inline-flex flex-col", className)}>
      {line && (
        <span className="text-3 font-3 leading-none text-text-2">{line}</span>
      )}
      <span className="type-title-lg leading-none">{puzzle.name}</span>
    </span>
  );
}
