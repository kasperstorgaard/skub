import { define } from "#/core.ts";
import { awardScore } from "#/db/score.ts";
import { saveSolution, updateSolutionAggregates } from "#/db/solutions.ts";
import type { Solution } from "#/db/types.ts";
import { getPuzzle } from "#/game/loader.ts";
import { getSolveScore } from "#/game/score.ts";
import { isAuthorized } from "#/routes/api/e2e/_auth.ts";

export const handler = define.handlers({
  async POST(ctx) {
    if (!isAuthorized(ctx.req)) {
      return new Response("Forbidden", { status: 403 });
    }

    let body: Omit<Solution, "id">;
    try {
      body = await ctx.req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (!body.puzzleSlug || !body.moves?.length || !body.name) {
      return new Response("Missing puzzleSlug, name, or moves", {
        status: 400,
      });
    }

    const puzzle = await getPuzzle(body.puzzleSlug);
    if (!puzzle) return new Response("No such puzzle", { status: 404 });

    const { isNew, isNewPath, solution } = await saveSolution(body);
    if (!isNew) {
      return new Response("Duplicate solution", { status: 409 });
    }

    // Seeded solves earn stars like played ones.
    const kinds = getSolveScore(puzzle, {
      moves: solution.moves.length,
      isNewPath,
      flash: !!solution.flash,
    });
    // Like the solve POST: a Flash solve isn't in the aggregates.
    await Promise.all([
      solution.flash ? undefined : updateSolutionAggregates(solution),
      awardScore(solution.userId, solution.puzzleSlug, kinds),
    ]);

    return Response.json(solution);
  },
});
