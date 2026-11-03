import { clsx } from "clsx/lite";

import type { Puzzle } from "#/game/types.ts";

type Props = {
  puzzle: Pick<Puzzle, "name" | "number">;
  /** lg: page titles, md: cards */
  size?: "lg" | "md";
  className?: string;
};

/**
 * A puzzle's number and name as one title: the number sits one size down at
 * regular weight, on the name's baseline.
 */
export function PuzzleName({ puzzle, size = "md", className }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex flex-wrap items-baseline gap-x-2",
        size === "lg" ? "type-title-lg" : "type-title",
        className,
      )}
    >
      {puzzle.number && (
        <span className={clsx("font-4", size === "lg" ? "text-4" : "text-3")}>
          #{puzzle.number}
        </span>
      )}
      <span>{puzzle.name}</span>
    </span>
  );
}
