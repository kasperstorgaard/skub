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
 */
const solutionScoreKey = (userId: string, puzzleSlug: string) => [
  "solution_score_by_user_puzzle",
  userId,
  puzzleSlug,
];
const userScoreKey = (userId: string) => ["user_score", userId];
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

/** A highscore key past its prefix: `[total, first, perfect, userId]`. */
type HighscoreRankKey = [number, number, number, string];

/** As KV orders the keys: by number, then the user id. */
function compareRankKeys(a: HighscoreRankKey, b: HighscoreRankKey): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2] ||
    (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0);
}

/** How long an isolate keeps the board before walking it again. */
const HIGHSCORE_CACHE_MS = 5 * 60_000;
let highscoreCache:
  | { keys: Promise<HighscoreRankKey[]>; expiresAt: number }
  | null = null;

/**
 * Every highscore key, low to high, as of the last walk: one walk per isolate
 * per few minutes, shared by every viewer it ranks. The promise is cached, so
 * viewers arriving mid-walk wait on the same one.
 */
function getHighscoreRankKeys(): Promise<HighscoreRankKey[]> {
  if (highscoreCache && highscoreCache.expiresAt > Date.now()) {
    return highscoreCache.keys;
  }

  const keys = (async () => {
    const keys: HighscoreRankKey[] = [];
    for await (const { key } of kv.list({ prefix: ["highscore"] })) {
      keys.push(key.slice(1) as HighscoreRankKey);
    }
    return keys;
  })();
  highscoreCache = { keys, expiresAt: Date.now() + HIGHSCORE_CACHE_MS };
  // A failed walk isn't kept: the next viewer tries again.
  keys.catch(() => highscoreCache = null);
  return keys;
}

/**
 * Where a player ranks all time, 1 for the top: one past everyone above their
 * score now, on the cached board. Their own points count at once, everyone
 * else's as of the last walk.
 */
export async function getHighscorePlacement(
  userId: string,
): Promise<{ rank: number; userScore: UserScore } | null> {
  const userScore = await getUserScore(userId);
  if (getTotalScore(userScore) === 0) return null;

  const keys = await getHighscoreRankKeys();
  const own: HighscoreRankKey = [...getHighscoreRank(userScore), userId];

  // The first key above theirs; everything from it on ranks higher.
  let low = 0;
  let high = keys.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (compareRankKeys(keys[mid], own) <= 0) low = mid + 1;
    else high = mid;
  }
  return { rank: keys.length - low + 1, userScore };
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
