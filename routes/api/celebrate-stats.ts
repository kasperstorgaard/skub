import { trace } from "@opentelemetry/api";

import { define } from "#/core.ts";
import { getPuzzleStats, getUserStats } from "#/db/stats.ts";
import { defaultPuzzleStats } from "#/game/stats.ts";
import type { UserStats } from "#/game/streak.ts";
import type { PuzzleStats } from "#/game/types.ts";

export type CelebrateStats = {
  puzzleStats: PuzzleStats;
  userStats: UserStats | null;
};

/**
 * GET /api/celebrate-stats?slug=<slug>
 *
 * Returns fresh puzzle + user stats for the CelebrationDialog island fetch.
 * Called client-side after AutoPostSolution completes, so both stats reflect
 * the just-submitted solution.
 */
export const handler = define.handlers({
  async GET(ctx) {
    const slug = ctx.url.searchParams.get("slug");

    if (!slug) {
      return Response.json({ error: "Missing slug" }, { status: 400 });
    }

    const savedName = ctx.state.user?.name ?? null;

    const activeSpan = trace.getActiveSpan();

    activeSpan?.setAttribute("puzzle.slug", slug);
    activeSpan?.setAttribute("user.has_name", savedName != null);

    const [puzzleStats, userStats] = await Promise.all([
      getPuzzleStats(slug),
      savedName ? getUserStats(ctx.state.userId) : Promise.resolve(null),
    ]);

    const body: CelebrateStats = {
      puzzleStats: puzzleStats ?? defaultPuzzleStats,
      userStats,
    };

    return Response.json(body);
  },
});
