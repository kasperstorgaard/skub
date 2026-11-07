import { getCanonicalMoveKey } from "#/game/strings.ts";
import type { Move, Puzzle } from "#/game/types.ts";

/**
 * What a puzzle can score, one point per kind, each earned once per player for
 * all time. How it's shown is up to the UI. `getHighscoreRank` reads first and
 * perfect as the rarer kinds.
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

/**
 * The kinds a solve scores, earned or not. A Flash solve earns Flash in
 * place of solve, and nothing else: perfect and first need a full solve.
 */
export function getSolveScore(
  puzzle: Pick<Puzzle, "minMoves">,
  solve: ScoreSolve,
): ScoreKind[] {
  if (solve.flash) return ["flash"];

  const kinds: ScoreKind[] = ["solve"];
  if (solve.moves <= puzzle.minMoves) kinds.push("perfect");
  if (solve.isNewPath) kinds.push("first");
  return kinds;
}

/** The kinds not earned yet, in display order. */
export function getNewScore(
  earned: ScoreKind[],
  kinds: ScoreKind[],
): ScoreKind[] {
  return SCORE_KINDS.filter((kind) =>
    kinds.includes(kind) && !earned.includes(kind)
  );
}

/** A user score with one point of each kind added. */
export function withScore(
  userScore: UserScore,
  kinds: ScoreKind[],
): UserScore {
  const updated = { ...userScore };
  for (const kind of kinds) updated[kind]++;
  return updated;
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
    earnedByUser.set(userId, [...earned, ...getNewScore(earned, kinds)]);
  }

  return earnedByUser;
}
