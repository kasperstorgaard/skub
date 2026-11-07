import { getCanonicalMoveKey } from "#/game/strings.ts";
import type { Move } from "#/game/types.ts";

/** A path, and the solutions that took it in the order they were found. */
export type PathGroup<T> = {
  canonicalKey: string;
  /** Moves on the path, after any skipped start. */
  moves: number;
  solutions: T[];
};

/**
 * Solutions grouped by path, shortest first, ties by who found theirs first.
 * `skip` leaves out a start every solution shares, such as a Flash start, so
 * paths are told apart and counted from where play began.
 */
export function getPathGroups<T extends { moves: Move[] }>(
  solutions: T[],
  { skip = 0 }: { skip?: number } = {},
): PathGroup<T>[] {
  const groups = new Map<string, PathGroup<T>>();

  for (const solution of solutions) {
    const moves = solution.moves.slice(skip);
    const canonicalKey = getCanonicalMoveKey(moves);
    const group = groups.get(canonicalKey) ??
      { canonicalKey, moves: moves.length, solutions: [] };
    group.solutions.push(solution);
    groups.set(canonicalKey, group);
  }

  // Sort is stable: equal lengths keep the order their paths were found in.
  return [...groups.values()].sort((a, b) => a.moves - b.moves);
}
