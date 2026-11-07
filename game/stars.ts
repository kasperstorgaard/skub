import { getCanonicalMoveKey } from "#/game/strings.ts";
import type { Move, Puzzle } from "#/game/types.ts";

/**
 * The stars a puzzle can give, each earned once per player for all time. The
 * order is the display order, and `getStarRank` reads first and perfect as the
 * rarer kinds.
 */
export const STAR_KINDS = ["solve", "perfect", "first", "flash"] as const;
export type StarKind = typeof STAR_KINDS[number];

/** A player's star count per kind, across all puzzles. */
export type StarTotals = Record<StarKind, number>;

export type StarSolve = {
  moves: number;
  /** No one had found this path before. Never true for a Flash solve. */
  isNewPath: boolean;
  flash: boolean;
};

export const emptyStarTotals: StarTotals = {
  solve: 0,
  perfect: 0,
  first: 0,
  flash: 0,
};

/**
 * The stars a solve qualifies for, earned or not. A Flash solve earns Flash in
 * place of solve, and nothing else: perfect and first need a full solve.
 */
export function getSolveStars(
  puzzle: Pick<Puzzle, "minMoves">,
  solve: StarSolve,
): StarKind[] {
  if (solve.flash) return ["flash"];

  const kinds: StarKind[] = ["solve"];
  if (solve.moves <= puzzle.minMoves) kinds.push("perfect");
  if (solve.isNewPath) kinds.push("first");
  return kinds;
}

/** The kinds not earned yet, in display order. */
export function getNewStars(
  earned: StarKind[],
  kinds: StarKind[],
): StarKind[] {
  return STAR_KINDS.filter((kind) =>
    kinds.includes(kind) && !earned.includes(kind)
  );
}

/** Totals with one star of each kind added. */
export function withStars(
  totals: StarTotals,
  kinds: StarKind[],
): StarTotals {
  const updated = { ...totals };
  for (const kind of kinds) updated[kind]++;
  return updated;
}

export function getStarCount(totals: StarTotals): number {
  return STAR_KINDS.reduce((count, kind) => count + totals[kind], 0);
}

/**
 * Sorts players by star count, ties broken by first, then perfect. Compares
 * as a KV key part, so a reversed list reads in rank order.
 */
export function getStarRank(totals: StarTotals): [number, number, number] {
  return [getStarCount(totals), totals.first, totals.perfect];
}

/**
 * The stars each player has earned on a puzzle from its past solves, given in
 * solve order: first goes to whoever found a path before anyone else.
 */
export function getPastStars(
  puzzle: Pick<Puzzle, "minMoves">,
  solves: { userId: string; moves: Move[]; flash?: boolean }[],
): Map<string, StarKind[]> {
  const paths = new Set<string>();
  const earnedByUser = new Map<string, StarKind[]>();

  for (const { userId, moves, flash = false } of solves) {
    const path = getCanonicalMoveKey(moves);
    const isNewPath = !flash && !paths.has(path);
    if (!flash) paths.add(path);

    const earned = earnedByUser.get(userId) ?? [];
    const kinds = getSolveStars(puzzle, {
      moves: moves.length,
      isNewPath,
      flash,
    });
    earnedByUser.set(userId, [...earned, ...getNewStars(earned, kinds)]);
  }

  return earnedByUser;
}
