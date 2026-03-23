import { Move, PuzzleManifestEntry } from "#/game/types.ts";

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

/**
 * Pure computation: derives streak and solve stats from entries and solutions.
 * Entries must be newest-first.
 */
export function computeUserStats(
  entries: Pick<PuzzleManifestEntry, "slug" | "minMoves">[],
  solutions: { puzzleSlug: string; moves: Move[] }[],
): UserStats {
  // Build a set of solved slugs for O(1) lookup
  const solvedSlugs = new Set<string>();
  for (const solution of solutions) {
    solvedSlugs.add(solution.puzzleSlug);
  }

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
  const entryBySlug = new Map(entries.map((e) => [e.slug, e]));
  // Track optimal per puzzle (best attempt wins)
  const optimalBySlug = new Set<string>();
  for (const solution of solutions) {
    const entry = entryBySlug.get(solution.puzzleSlug);
    if (entry && solution.moves.length === entry.minMoves) {
      optimalBySlug.add(solution.puzzleSlug);
    }
  }
  const optimalSolves = optimalBySlug.size;

  return { currentStreak, bestStreak, totalSolves, optimalSolves };
}
