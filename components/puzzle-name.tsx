import { clsx } from "clsx/lite";

import type { Puzzle } from "#/game/types.ts";

type Props = {
  puzzle: Pick<Puzzle, "name" | "number" | "onboardingLevel">;
  /** Overrides the line above the name, e.g. "Preview" */
  lead?: string;
  className?: string;
};

/**
 * What an unnumbered onboarding puzzle is called above its name: the tutorial
 * (itself named "Tutorial"), then starter and quick puzzles.
 */
export function getOnboardingLabel(level: number) {
  if (level === 1) return "Learn the basics";
  if (level === 2) return "Starter puzzle";
  return "Quick puzzle";
}

/**
 * A page's puzzle title: a line above, smaller, light and muted, like a card's
 * lead, then the name. The line is the puzzle's number, or for an unnumbered
 * onboarding puzzle what it is ("Starter puzzle"). Cards put this
 * in their lead instead (`PuzzleCard`).
 */
export function PuzzleName({ puzzle, lead, className }: Props) {
  const line = lead ??
    (puzzle.number
      ? `#${puzzle.number}`
      : puzzle.onboardingLevel
      ? getOnboardingLabel(puzzle.onboardingLevel)
      : undefined);

  return (
    <span className={clsx("inline-flex flex-col", className)}>
      {line && (
        <span className="text-3 font-3 leading-none text-text-2">{line}</span>
      )}
      <span className="type-title-lg leading-none">{puzzle.name}</span>
    </span>
  );
}
