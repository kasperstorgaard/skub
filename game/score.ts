import { getCanonicalMoveKey } from "#/game/strings.ts";
import type { Move, Puzzle } from "#/game/types.ts";

/**
 * What a puzzle can score, one point per kind, each earned once per player for
 * all time, three at most: Flash is a solve from the Flash start, and gives way
 * to solve once the puzzle is fully solved. How it's shown is up to the UI.
 * `getHighscoreRank` reads first and perfect as the rarer kinds.
 */
export const SCORE_KINDS = ["solve", "perfect", "first", "flash"] as const;
export type ScoreKind = typeof SCORE_KINDS[number];

/** A player's points per kind, across all puzzles. */
export type UserScore = Record<ScoreKind, number>;

export type ScoreSolve = {
  moves: number;
  /** This solve claimed the path: no one had found it before. Never Flash. */
  isNewPath: boolean;
  flash: boolean;
};

export const emptyUserScore: UserScore = {
  solve: 0,
  perfect: 0,
  first: 0,
  flash: 0,
};

/** How far past minimum moves a new path still earns first. */
export const FIRST_MAX_EXTRA_MOVES = 2;

/**
 * The kinds a solve scores, earned or not. A Flash solve earns Flash in
 * place of solve, and nothing else: perfect and first need a full solve.
 * First needs a near-optimal path, or any detour would find one.
 */
export function getSolveScore(
  puzzle: Pick<Puzzle, "minMoves">,
  solve: ScoreSolve,
): ScoreKind[] {
  if (solve.flash) return ["flash"];

  const kinds: ScoreKind[] = ["solve"];
  if (solve.moves <= puzzle.minMoves) kinds.push("perfect");
  if (
    solve.isNewPath &&
    solve.moves <= puzzle.minMoves + FIRST_MAX_EXTRA_MOVES
  ) kinds.push("first");
  return kinds;
}

/**
 * The kinds not earned yet, in display order. Flash is nothing new once the
 * puzzle is solved, or is being solved.
 */
export function getNewScore(
  earned: ScoreKind[],
  kinds: ScoreKind[],
): ScoreKind[] {
  const isSolved = earned.includes("solve") || kinds.includes("solve");
  return SCORE_KINDS.filter((kind) =>
    kinds.includes(kind) && !earned.includes(kind) &&
    !(kind === "flash" && isSolved)
  );
}

/** A solution score with kinds added, in display order: solve replaces Flash. */
export function withEarned(
  earned: ScoreKind[],
  kinds: ScoreKind[],
): ScoreKind[] {
  const isSolved = earned.includes("solve") || kinds.includes("solve");
  return SCORE_KINDS.filter((kind) =>
    (earned.includes(kind) || kinds.includes(kind)) &&
    !(kind === "flash" && isSolved)
  );
}

/**
 * A user score after one puzzle's solution score went from `earned` to
 * `updated`: a point for each kind gained, one off for a Flash that gave way.
 */
export function withScore(
  userScore: UserScore,
  earned: ScoreKind[],
  updated: ScoreKind[],
): UserScore {
  const result = { ...userScore };
  for (const kind of SCORE_KINDS) {
    if (updated.includes(kind) && !earned.includes(kind)) result[kind]++;
    if (earned.includes(kind) && !updated.includes(kind)) result[kind]--;
  }
  return result;
}

export function getTotalScore(userScore: UserScore): number {
  return SCORE_KINDS.reduce((count, kind) => count + userScore[kind], 0);
}

/**
 * Sorts the highscore by total score, ties broken by first, then perfect. Compares
 * as a KV key part, so a reversed list reads in rank order.
 */
export function getHighscoreRank(
  userScore: UserScore,
): [number, number, number] {
  return [getTotalScore(userScore), userScore.first, userScore.perfect];
}

type PastSolve = { moves: Move[]; flash?: boolean; first?: boolean };

/**
 * A puzzle's solves, in solve order, with `first` on the earliest solve of
 * each path and on no other. Flash solves never find a path.
 */
export function withFirstSolves<T extends PastSolve>(solves: T[]): T[] {
  const paths = new Set<string>();

  return solves.map((solve) => {
    const { first: _, ...rest } = solve;
    if (solve.flash) return rest as T;

    const path = getCanonicalMoveKey(solve.moves);
    if (paths.has(path)) return rest as T;
    paths.add(path);
    return { ...rest, first: true } as T;
  });
}

/** The kinds each player has scored on a puzzle from its solves. */
export function getPastScore(
  puzzle: Pick<Puzzle, "minMoves">,
  solves: (PastSolve & { userId: string })[],
): Map<string, ScoreKind[]> {
  const earnedByUser = new Map<string, ScoreKind[]>();

  for (const { userId, moves, flash = false, first = false } of solves) {
    const earned = earnedByUser.get(userId) ?? [];
    const kinds = getSolveScore(puzzle, {
      moves: moves.length,
      isNewPath: first,
      flash,
    });
    earnedByUser.set(userId, withEarned(earned, kinds));
  }

  return earnedByUser;
}
