import type { Move, Puzzle, SkillLevel } from "#/game/types.ts";

/**
 * Returns the skill level earned after a solve. Returns the current level unchanged
 * if no promotion applies — safe to call unconditionally and compare for change.
 *
 * Rules (first match wins):
 *   expert       — medium/hard solved perfectly
 *   intermediate — medium solved within 1.33× optimal, OR easy solved perfectly with minMoves > 5
 *   beginner     — any solve by a user with no skill level yet (skip-tutorial path)
 */
export function assessSkillLevel(
  puzzle: Pick<Puzzle, "difficulty" | "minMoves">,
  moves: Move[],
  { current = null }: { current?: SkillLevel | null } = {},
): SkillLevel | null {
  const { difficulty, minMoves } = puzzle;
  const count = moves.length;

  if (
    (difficulty === "medium" || difficulty === "hard") &&
    count === minMoves &&
    current !== "expert"
  ) {
    return "expert";
  }

  if (current !== "intermediate" && current !== "expert") {
    if (difficulty === "medium" && count <= minMoves * 1.33) {
      return "intermediate";
    }
    if (difficulty === "easy" && count === minMoves && minMoves > 5) {
      return "intermediate";
    }
  }

  if (current === null) return "beginner";

  return current;
}
