import { trace } from "@opentelemetry/api";
import { HttpError } from "fresh";

import { define } from "#/core.ts";
import { saveSolution } from "#/db/solutions.ts";
import { setUser } from "#/db/user.ts";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import { getDayOfYear } from "#/game/date.ts";
import { getPuzzle } from "#/game/loader.ts";
import { assessSkillLevel } from "#/game/skill.ts";
import type { Move } from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";
import { withSpan } from "#/lib/tracing.ts";
import { trackPuzzleSolved, trackSkillLevelUp } from "#/lib/tracking.ts";

/**
 * POST /api/solutions
 *
 * Post a solution for a puzzle, returns
 */
export const handler = define.handlers({
  async POST(ctx) {
    const form = await ctx.req.formData();
    const name = form.get("name")?.toString();
    const puzzleSlug = form.get("puzzleSlug")?.toString();

    if (!name) throw new HttpError(400, "Must provide a username");
    if (!puzzleSlug) throw new HttpError(400, "Must provide puzzleSlug");

    const puzzle = await getPuzzle(puzzleSlug);
    if (!puzzle) throw new HttpError(404, `Unknown puzzle: ${puzzleSlug}`);

    if (!isDev && puzzle.number) {
      const dayOfYear = getDayOfYear(new Date(Date.now()));
      if (puzzle.number > dayOfYear) throw new HttpError(404);
    }

    const rawMoves = form.get("moves")?.toString() ?? "";
    const moves = JSON.parse(rawMoves) as Move[];

    if (!isValidSolution(resolveMoves(puzzle.board, moves))) {
      throw new HttpError(400, "Solution is not valid");
    }

    const activeSpan = trace.getActiveSpan();
    activeSpan?.setAttribute("solution.moves", moves.length);

    const [{ isNew, isNewPath }] = await Promise.all([
      withSpan("puzzle.save_solution", async (span) => {
        const result = await saveSolution({
          puzzleSlug,
          name,
          moves,
          userId: ctx.state.userId,
        });
        span.setAttribute("solution.is_new", result.isNew);
        span.setAttribute("solution.is_new_path", result.isNewPath);
        return result;
      }),
      setUser(ctx.state.userId, { name }),
    ]);

    if (isNew) {
      const referer = ctx.req.headers.get("referer") ?? "";
      trackPuzzleSolved(ctx.state, puzzle, { moves, url: referer });

      const { skillLevel } = ctx.state.user;
      const newLevel = assessSkillLevel(puzzle, moves, { current: skillLevel });

      if (newLevel && newLevel !== skillLevel) {
        await setUser(ctx.state.userId, { skillLevel: newLevel });
        trackSkillLevelUp(ctx.state, puzzle, {
          moves,
          url: referer,
          skillLevel: newLevel,
        });
      }
    }

    return Response.json({ isNewPath });
  },
});
