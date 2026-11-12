import { kv, rawKv } from "#/db/kv.ts";
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
 *
 * Apart from those, a snapshot ranks players past the top rows: per score,
 * keyed `[total, first, perfect]`, how many players are on it or above,
 * rebuilt from the highscore by a cron.
 */
const solutionScoreKey = (userId: string, puzzleSlug: string) => [
  "solution_score_by_user_puzzle",
  userId,
  puzzleSlug,
];
const userScoreKey = (userId: string) => ["user_score", userId];
const highscoreAboveKey = (rank: Deno.KvKeyPart[]) => [
  "highscore_above",
  ...rank,
];

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
 * Where a player ranks all time, 1 for the top: one past everyone on the
 * lowest score above theirs or higher, in the snapshot. Read by their score
 * now, so their own points count at once; everyone else's as of the last
 * rebuild. Players on the same score share a rank. None until they've scored.
 */
export async function getHighscorePlacement(
  userId: string,
): Promise<{ rank: number; userScore: UserScore } | null> {
  const userScore = await getUserScore(userId);
  if (getTotalScore(userScore) === 0) return null;

  // Starts just past their own score's key: longer keys sort after it.
  const iter = kv.list<number>({
    prefix: ["highscore_above"],
    start: [...highscoreAboveKey(getHighscoreRank(userScore)), ""],
  }, { limit: 1 });
  let above = 0;
  for await (const { value } of iter) above = value;
  return { rank: above + 1, userScore };
}

/**
 * Rebuilds the snapshot from the highscore: a walk over every player, top
 * down, then writes only the scores whose count changed, and deletes the
 * scores no one is on. Not one commit: a read meanwhile may see a mix, set
 * right on the next run.
 */
export async function rebuildHighscoreAbove(): Promise<void> {
  // Players on each score or above, top down.
  const atOrAbove = new Map<
    string,
    { rank: Deno.KvKeyPart[]; count: number }
  >();
  let count = 0;
  const iter = rawKv.list({ prefix: ["highscore"] }, {
    reverse: true,
    batchSize: 1000,
  });
  for await (const { key } of iter) {
    const rank = key.slice(1, 4);
    count++;
    atOrAbove.set(JSON.stringify(rank), { rank, count });
  }

  const existing = new Map<string, number>();
  for await (
    const { key, value } of rawKv.list<number>({ prefix: ["highscore_above"] })
  ) {
    existing.set(JSON.stringify(key.slice(1)), value);
  }

  const mutations: ((atomic: Deno.AtomicOperation) => void)[] = [];
  for (const [id, { rank, count }] of atOrAbove) {
    if (existing.get(id) !== count) {
      mutations.push((atomic) => atomic.set(highscoreAboveKey(rank), count));
    }
    existing.delete(id);
  }
  for (const id of existing.keys()) {
    const rank = JSON.parse(id) as Deno.KvKeyPart[];
    mutations.push((atomic) => atomic.delete(highscoreAboveKey(rank)));
  }

  for (let i = 0; i < mutations.length; i += 500) {
    const atomic = rawKv.atomic();
    for (const mutate of mutations.slice(i, i + 500)) mutate(atomic);
    await atomic.commit();
  }
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
    const [solutionScoreEntry, userScoreEntry] = await kv.getMany<
      [ScoreKind[], UserScore]
    >([solutionScoreKey(userId, puzzleSlug), userScoreKey(userId)]);

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
      .set(solutionScoreKey(userId, puzzleSlug), updatedEarned)
      .set(userScoreKey(userId), updated);
    // Delete before set: with the same points it's the same key.
    if (userScoreEntry.value) atomic.delete(getHighscoreKey(userId, current));
    atomic.set(getHighscoreKey(userId, updated), updated);

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
    const userScoreEntry = await kv.get<UserScore>(userScoreKey(userId));
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
    const atomic = kv.atomic().check(userScoreEntry);
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

    const result = await atomic.commit();
    if (result.ok) return added;
  }

  throw new Error("Failed to award past score after 5 attempts");
}
