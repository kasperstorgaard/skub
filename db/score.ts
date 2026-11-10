import { kv } from "#/db/kv.ts";
import {
  emptyUserScore,
  getHighscoreRank,
  getNewScore,
  getTotalScore,
  type HighscoreEntry,
  SCORE_KINDS,
  type ScoreKind,
  type ScoreProgress,
  type UserScore,
  withEarned,
  withScore,
} from "#/game/score.ts";

/**
 * Score lives in three places, written together:
 * - solution score: the kinds of a user's best solution on a puzzle
 * - user score: their points per kind across all puzzles
 * - the highscore, keyed `[total, first, perfect, userId]`, so a reversed list
 *   reads in rank order. Its value is the user score, so a list needs no
 *   lookups.
 * - highscore counts: players per `[total, first, perfect]`, so a rank is a
 *   sum over the scores above, not a walk over the players. A counted flag
 *   per player says they're in them: only a counted player's old score loses
 *   one, so a count never goes below what's there.
 */
const solutionScoreKey = (userId: string, puzzleSlug: string) => [
  "solution_score_by_user_puzzle",
  userId,
  puzzleSlug,
];
const userScoreKey = (userId: string) => ["user_score", userId];
const highscoreCountKey = (userScore: UserScore) => [
  "highscore_count",
  ...getHighscoreRank(userScore),
];
const highscoreCountedKey = (userId: string) => ["highscore_counted", userId];

/** Where a user sits on the highscore, given their user score. */
export const getHighscoreKey = (userId: string, userScore: UserScore) => [
  "highscore",
  ...getHighscoreRank(userScore),
  userId,
];

/** The kinds a player has earned on a puzzle, in display order. */
export async function getSolutionScore(
  userId: string,
  puzzleSlug: string,
): Promise<ScoreKind[]> {
  const res = await kv.get<ScoreKind[]>(solutionScoreKey(userId, puzzleSlug));
  return res.value ?? [];
}

/** A player's solution score on every puzzle, each in display order. */
export async function listSolutionScores(
  userId: string,
): Promise<ScoreProgress> {
  const score: ScoreProgress = {};
  const iter = kv.list<ScoreKind[]>({
    prefix: ["solution_score_by_user_puzzle", userId],
  });
  for await (const { key, value } of iter) {
    score[key[2] as string] = SCORE_KINDS.filter((kind) =>
      value.includes(kind)
    );
  }
  return score;
}

export async function getUserScore(userId: string): Promise<UserScore> {
  const res = await kv.get<UserScore>(userScoreKey(userId));
  return { ...emptyUserScore, ...res.value };
}

/** The top of the highscore, in rank order. */
export async function listHighscore(
  { limit = 50 }: { limit?: number } = {},
): Promise<HighscoreEntry[]> {
  const entries: HighscoreEntry[] = [];
  const iter = kv.list<UserScore>({ prefix: ["highscore"] }, {
    reverse: true,
    limit,
  });
  for await (const { key, value } of iter) {
    entries.push({
      userId: key[4] as string,
      userScore: { ...emptyUserScore, ...value },
    });
  }
  return entries;
}

/**
 * Where a player ranks all time, 1 for the top, from the counts of every score
 * above theirs: as many reads as there are such scores, not players. Players
 * on the same score share a rank. None until they've scored.
 */
export async function getHighscorePlacement(
  userId: string,
): Promise<{ rank: number; userScore: UserScore } | null> {
  const userScore = await getUserScore(userId);
  if (getTotalScore(userScore) === 0) return null;

  // Starts just past their own score's key: longer keys sort after it.
  const iter = kv.list<Deno.KvU64>({
    prefix: ["highscore_count"],
    start: [...highscoreCountKey(userScore), ""],
  });
  let above = 0n;
  for await (const { value } of iter) above += value.value;
  return { rank: Number(above) + 1, userScore };
}

// `sum` wraps at 2^64, so adding its max takes one off.
const MINUS_ONE = 0xffff_ffff_ffff_ffffn;

/**
 * Moves a player's count from their old score to their new one, and marks
 * them counted. Uncounted, their old score never had them, so only the new one
 * gains.
 */
function withHighscoreCount(
  atomic: Deno.AtomicOperation,
  userId: string,
  { current, updated, isCounted }: {
    current: UserScore;
    updated: UserScore;
    isCounted: boolean;
  },
) {
  const from = highscoreCountKey(current);
  const to = highscoreCountKey(updated);
  // A Flash giving way to a solve can leave the rank as it was.
  if (isCounted && from.join() === to.join()) return;

  if (isCounted) atomic.sum(from, MINUS_ONE);
  atomic.sum(to, 1n);
  atomic.set(highscoreCountedKey(userId), true);
}

/**
 * Awards a solve that beats the player's best solution on the puzzle, and
 * returns the kinds it adds; nothing when it's no better.
 * Solution score, user score and highscore move in one commit, retried on conflict.
 */
export async function awardScore(
  userId: string,
  puzzleSlug: string,
  kinds: ScoreKind[],
): Promise<ScoreKind[]> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const [solutionScoreEntry, userScoreEntry, countedEntry] = await kv
      .getMany<[ScoreKind[], UserScore, true]>([
        solutionScoreKey(userId, puzzleSlug),
        userScoreKey(userId),
        highscoreCountedKey(userId),
      ]);

    const earned = solutionScoreEntry.value ?? [];
    const added = getNewScore(earned, kinds);
    if (added.length === 0) return [];
    const updatedEarned = withEarned(earned, kinds);

    // Spread over the empty score, so a kind added later starts at 0.
    const current = { ...emptyUserScore, ...userScoreEntry.value };
    const updated = withScore(current, earned, updatedEarned);

    const atomic = kv.atomic()
      .check(solutionScoreEntry)
      .check(userScoreEntry)
      .check(countedEntry)
      .set(solutionScoreKey(userId, puzzleSlug), updatedEarned)
      .set(userScoreKey(userId), updated);
    // Delete before set: with the same points it's the same key.
    if (userScoreEntry.value) atomic.delete(getHighscoreKey(userId, current));
    atomic.set(getHighscoreKey(userId, updated), updated);
    withHighscoreCount(atomic, userId, {
      current,
      updated,
      isCounted: !!countedEntry.value,
    });

    const result = await atomic.commit();
    if (result.ok) return added;
  }

  throw new Error("Failed to award score after 5 attempts");
}

/**
 * Awards a player's past solves on many puzzles in one commit, keeping the
 * better of each puzzle's earned and past kinds. Checked against the user
 * score, which every award writes, so a live award in between retries.
 * Returns how many kinds it adds.
 */
export async function awardPastScore(
  userId: string,
  scoreByPuzzle: Map<string, ScoreKind[]>,
): Promise<number> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    // The user score first: an award after it fails the check.
    const [userScoreEntry, countedEntry] = await kv.getMany<
      [UserScore, true]
    >([userScoreKey(userId), highscoreCountedKey(userId)]);
    const earnedByPuzzle = new Map<string, ScoreKind[]>();
    const iter = kv.list<ScoreKind[]>({
      prefix: ["solution_score_by_user_puzzle", userId],
    });
    for await (const { key, value } of iter) {
      earnedByPuzzle.set(key[2] as string, value);
    }

    const current = { ...emptyUserScore, ...userScoreEntry.value };
    let updated = current;
    let added = 0;
    const atomic = kv.atomic().check(userScoreEntry).check(countedEntry);
    for (const [puzzleSlug, kinds] of scoreByPuzzle) {
      const earned = earnedByPuzzle.get(puzzleSlug) ?? [];
      const gained = getNewScore(earned, kinds);
      if (gained.length === 0) continue;
      const updatedEarned = withEarned(earned, kinds);
      updated = withScore(updated, earned, updatedEarned);
      atomic.set(solutionScoreKey(userId, puzzleSlug), updatedEarned);
      added += gained.length;
    }
    if (added === 0) return 0;

    atomic.set(userScoreKey(userId), updated);
    // Delete before set: with the same points it's the same key.
    if (userScoreEntry.value) atomic.delete(getHighscoreKey(userId, current));
    atomic.set(getHighscoreKey(userId, updated), updated);
    withHighscoreCount(atomic, userId, {
      current,
      updated,
      isCounted: !!countedEntry.value,
    });

    const result = await atomic.commit();
    if (result.ok) return added;
  }

  throw new Error("Failed to award past score after 5 attempts");
}
