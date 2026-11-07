import { kv } from "#/db/kv.ts";
import {
  emptyScoreTotals,
  getNewScore,
  getScoreRank,
  type ScoreKind,
  type ScoreTotals,
  withScore,
} from "#/game/score.ts";

/**
 * Score lives in three places, written together:
 * - earned kinds per user and puzzle
 * - totals per kind per user
 * - a ranking index, `[count, first, perfect, userId]`, so a reversed list
 *   reads in rank order. Its value is the totals, so a list needs no lookups.
 */
const earnedKey = (userId: string, puzzleSlug: string) => [
  "score_by_user_puzzle",
  userId,
  puzzleSlug,
];
const totalsKey = (userId: string) => ["score_totals_by_user", userId];
const rankingKey = (userId: string, totals: ScoreTotals) => [
  "score_ranking",
  ...getScoreRank(totals),
  userId,
];

/** The kinds a player has earned on a puzzle, in the order earned. */
export async function getPuzzleScore(
  userId: string,
  puzzleSlug: string,
): Promise<ScoreKind[]> {
  const res = await kv.get<ScoreKind[]>(earnedKey(userId, puzzleSlug));
  return res.value ?? [];
}

export async function getScoreTotals(userId: string): Promise<ScoreTotals> {
  const res = await kv.get<ScoreTotals>(totalsKey(userId));
  return res.value ?? emptyScoreTotals;
}

/**
 * Awards the kinds a player hasn't earned on the puzzle yet, and returns them.
 * Earned kinds, totals and ranking move in one commit, retried on conflict.
 */
export async function awardScore(
  userId: string,
  puzzleSlug: string,
  kinds: ScoreKind[],
): Promise<ScoreKind[]> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const [earnedEntry, totalsEntry] = await kv.getMany<
      [ScoreKind[], ScoreTotals]
    >([earnedKey(userId, puzzleSlug), totalsKey(userId)]);

    const earned = earnedEntry.value ?? [];
    const added = getNewScore(earned, kinds);
    if (added.length === 0) return [];

    const totals = totalsEntry.value ?? emptyScoreTotals;
    const updated = withScore(totals, added);

    const atomic = kv.atomic()
      .check(earnedEntry)
      .check(totalsEntry)
      .set(earnedKey(userId, puzzleSlug), [...earned, ...added])
      .set(totalsKey(userId), updated)
      .set(rankingKey(userId, updated), updated);
    if (totalsEntry.value) atomic.delete(rankingKey(userId, totals));

    const result = await atomic.commit();
    if (result.ok) return added;
  }

  throw new Error("Failed to award score after 5 attempts");
}
