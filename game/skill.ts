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

  if (current === "expert") return "expert";

  // Solve a puzzle perfectly
  if (
    (difficulty === "medium" || difficulty === "hard") &&
    count === minMoves
  ) {
    return "expert";
  }

  if (current !== "intermediate") {
    // Solve a puzzle well
    if (difficulty !== "easy" && count <= minMoves + 3) {
      return "intermediate";
    }

    // Solve an easy puzzle perfectly
    if (difficulty === "easy" && count === minMoves && minMoves > 5) {
      return "intermediate";
    }
  }

  // Solve any puzzle suboptimally
  if (current === null) return "beginner";

  // No progression
  return current;
}
