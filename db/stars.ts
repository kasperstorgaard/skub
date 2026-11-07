import { kv } from "#/db/kv.ts";
import {
  emptyStarTotals,
  getNewStars,
  getStarRank,
  type StarKind,
  type StarTotals,
  withStars,
} from "#/game/stars.ts";

/**
 * Stars live in three places, written together:
 * - earned kinds per user and puzzle
 * - totals per kind per user
 * - a ranking index, `[count, first, perfect, userId]`, so a reversed list
 *   reads in rank order. Its value is the totals, so a list needs no lookups.
 */
const earnedKey = (userId: string, puzzleSlug: string) => [
  "stars_by_user_puzzle",
  userId,
  puzzleSlug,
];
const totalsKey = (userId: string) => ["star_totals_by_user", userId];
const rankingKey = (userId: string, totals: StarTotals) => [
  "star_ranking",
  ...getStarRank(totals),
  userId,
];

/** The kinds a player has earned on a puzzle, in the order earned. */
export async function getEarnedStars(
  userId: string,
  puzzleSlug: string,
): Promise<StarKind[]> {
  const res = await kv.get<StarKind[]>(earnedKey(userId, puzzleSlug));
  return res.value ?? [];
}

export async function getStarTotals(userId: string): Promise<StarTotals> {
  const res = await kv.get<StarTotals>(totalsKey(userId));
  return res.value ?? emptyStarTotals;
}

/**
 * Awards the kinds a player hasn't earned on the puzzle yet, and returns them.
 * Earned kinds, totals and ranking move in one commit, retried on conflict.
 */
export async function awardStars(
  userId: string,
  puzzleSlug: string,
  kinds: StarKind[],
): Promise<StarKind[]> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const [earnedEntry, totalsEntry] = await kv.getMany<
      [StarKind[], StarTotals]
    >([earnedKey(userId, puzzleSlug), totalsKey(userId)]);

    const earned = earnedEntry.value ?? [];
    const added = getNewStars(earned, kinds);
    if (added.length === 0) return [];

    const totals = totalsEntry.value ?? emptyStarTotals;
    const updated = withStars(totals, added);

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

  throw new Error("Failed to award stars after 5 attempts");
}
