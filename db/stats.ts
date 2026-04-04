import { kv } from "#/db/kv.ts";
import { listUserSolutions } from "#/db/solutions.ts";
import { PuzzleStats, Solution } from "#/db/types.ts";
import { getAvailableEntries } from "#/game/loader.ts";
import { computeUserStats, UserStats } from "#/game/streak.ts";

export async function getPuzzleStats(
  puzzleSlug: string,
): Promise<PuzzleStats | null> {
  const res = await kv.get<PuzzleStats>(["puzzle_stats", puzzleSlug]);
  return res.value;
}

/**
 * Increments the move histogram, total solution count, firstSolvedAt (once),
 * uniqueSolvers (via presence key when userId is provided), for a puzzle.
 * Retries on optimistic concurrency conflicts (two simultaneous solves).
 * Called as best-effort fire-and-forget after addSolution — may drift slightly.
 */
export async function updatePuzzleStats(
  puzzleSlug: string,
  moveCount: number,
  userId?: string,
) {
  const statsKey = ["puzzle_stats", puzzleSlug];
  const presenceKey = userId ? ["puzzle_solvers", puzzleSlug, userId] : null;

  // Best effort, try 5 times.
  let attempts = 1;
  const maxAttempts = 5;

  // we retry until successful
  while (true) {
    const [statsEntry, presenceEntry] = await Promise.all([
      kv.get<PuzzleStats>(statsKey),
      presenceKey ? kv.get<boolean>(presenceKey) : Promise.resolve(null),
    ]);

    const existing = statsEntry.value;
    const isNewSolver = presenceKey !== null && presenceEntry?.value == null;

    const solutionsHistogram = existing?.solutionsHistogram ?? {};
    solutionsHistogram[moveCount] = (solutionsHistogram[moveCount] ?? 0) + 1;

    const stats: PuzzleStats = {
      totalSolutions: (existing?.totalSolutions ?? 0) + 1,
      solutionsHistogram,
      firstSolvedAt: existing?.firstSolvedAt ?? new Date().toISOString(),
      uniqueSolvers: (existing?.uniqueSolvers ?? 0) + (isNewSolver ? 1 : 0),
      hintUsageCount: existing?.hintUsageCount ?? 0,
    };

    let atomic = kv.atomic().check(statsEntry).set(statsKey, stats);

    if (presenceEntry !== null) {
      atomic = atomic.check(presenceEntry);
      if (isNewSolver) atomic = atomic.set(presenceKey!, true);
    }

    const result = await atomic.commit();

    if (result.ok) return stats;
    else if (attempts >= maxAttempts) {
      throw new Error("Unable to update stats");
    } else {
      attempts++;
    }
  }
}

/**
 * Increments the hint usage count for a puzzle.
 * Called as best-effort fire-and-forget from the hint route.
 */
/**
 * Fetches data and computes streak/solve stats for a user.
 */
export async function getUserStats(
  userId: string,
  solutions?: Solution[],
): Promise<UserStats> {
  const [entries, resolvedSolutions] = await Promise.all([
    getAvailableEntries(),
    solutions
      ? Promise.resolve(solutions)
      : listUserSolutions(userId, { limit: "max" }),
  ]);

  return computeUserStats(entries, resolvedSolutions);
}

export async function incrementHintUsageCount(
  puzzleSlug: string,
): Promise<void> {
  const key = ["puzzle_stats", puzzleSlug];

  while (true) {
    const current = await kv.get<PuzzleStats>(key);
    const existing = current.value;

    if (!existing) return; // no stats yet — skip (hints before first solve are not counted)

    const updated: PuzzleStats = {
      ...existing,
      hintUsageCount: existing.hintUsageCount + 1,
    };

    const result = await kv.atomic().check(current).set(key, updated).commit();
    if (result.ok) break;
  }
}
