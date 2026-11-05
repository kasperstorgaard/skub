import { clsx } from "clsx/lite";

import type { Puzzle } from "#/game/types.ts";

type Props = {
  puzzle: Pick<Puzzle, "name" | "number">;
  /** lg: page titles, md: cards */
  size?: "lg" | "md";
  className?: string;
};

/**
 * A puzzle's number and name as one title. Page titles (lg) put the number
 * on its own line above, three sizes down and muted, like a card's lead; cards
 * (md) keep it on the name's baseline.
 */
export function PuzzleName(
  { puzzle, size = "md", className }: Props,
) {
  if (size === "lg") {
    return (
      <span className={clsx("inline-flex flex-col", className)}>
        {puzzle.number && (
          <span className="text-3 [font-weight:300] leading-none text-text-2">
            #{puzzle.number}
          </span>
        )}
        <span className="type-title-lg [font-weight:500] leading-none">
          {puzzle.name}
        </span>
      </span>
    );
  }

  return (
    <span
      className={clsx(
        "inline-flex flex-wrap items-baseline gap-x-2 type-title",
        className,
      )}
    >
      {puzzle.number && (
        <span className="[font-weight:300]">
          #{puzzle.number}
        </span>
      )}
      <span>{puzzle.name}</span>
    </span>
  );
}
