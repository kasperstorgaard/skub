import { isSolved, type Progress } from "#/game/progress.ts";
import type { ScoreProgress } from "#/game/score.ts";
import type { PuzzleManifestEntry } from "#/game/types.ts";

// TODO: replace perfect % with a player score (e.g. points per solve,
// bonus for optimal/streak) and add a global highscore leaderboard.

/**
 * Aggregate personal stats for a user.
 */
export type UserStats = {
  currentStreak: number;
  bestStreak: number;
  totalSolves: number;
  optimalSolves: number;
};

type StatsEntry = Pick<PuzzleManifestEntry, "slug" | "minMoves"> & {
  isFuture?: boolean;
};

/**
 * Pure computation: derives streak and solve stats from entries and progress.
 * Entries must be newest-first. Future ones (dev lists the whole schedule)
 * aren't playable yet, so they don't count.
 */
export function computeUserStats(
  allEntries: StatsEntry[],
  progress: Progress,
  score: ScoreProgress = {},
): UserStats {
  const entries = allEntries.filter((entry) => !entry.isFuture);
  // Solved in either variant: a Flash solve counts, but sets no best.
  const solvedSlugs = new Set(
    [...Object.keys(progress), ...Object.keys(score)].filter((slug) =>
      isSolved(slug, { progress, score })
    ),
  );

  // totalSolves: unique puzzle slugs solved
  const totalSolves = solvedSlugs.size;

  // Entries are newest-first. Current streak walks forward from the top;
  // skip today's puzzle if unsolved — the player still has time.
  // NOTE: solving archived puzzles fills gaps and extends the streak.
  // This is intentional — it rewards engagement regardless of timing.
  let currentStreak = 0;
  let start = 0;
  if (entries.length > 0 && !solvedSlugs.has(entries[0].slug)) {
    start = 1;
  }
  for (let i = start; i < entries.length; i++) {
    if (solvedSlugs.has(entries[i].slug)) {
      currentStreak++;
    } else {
      break;
    }
  }

  // bestStreak: walk full history (reversed to ascending); track running length
  let bestStreak = 0;
  let running = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (solvedSlugs.has(entries[i].slug)) {
      running++;
      if (running > bestStreak) bestStreak = running;
    } else {
      running = 0;
    }
  }

  // optimalSolves: solutions where moves.length === entry.minMoves
  // TODO: onboarding puzzles are excluded here (not in entries) but should count.
  // Tricky because they don't belong to the date-based archive system.
  const optimalSolves = entries
    .filter((entry) => progress[entry.slug] === entry.minMoves)
    .length;

  return { currentStreak, bestStreak, totalSolves, optimalSolves };
}
