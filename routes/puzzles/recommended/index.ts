import { define } from "#/core.ts";
import { listUserSolutions } from "#/db/solutions.ts";
import { pickRecommendedPuzzle } from "#/game/recommendation.ts";

/**
 * Picks the recommended puzzle for the current user (same logic as the home
 * page card) and 303s to `/puzzles/<slug>`. Falls back to `/` when nothing
 * can be recommended — new users without a skill level, or fully-perfected
 * players when "loke" can't be loaded.
 */
export const handler = define.handlers({
  async GET(ctx) {
    const solutions = await listUserSolutions(ctx.state.userId, {
      limit: "max",
    });

    const recommended = await pickRecommendedPuzzle(
      ctx.state.user,
      solutions,
    );

    const target = recommended
      ? new URL(`/puzzles/${recommended.slug}`, ctx.url)
      : new URL("/", ctx.url);

    return Response.redirect(target, 303);
  },
});
