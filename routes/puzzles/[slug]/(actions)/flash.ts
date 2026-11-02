import { HttpError } from "fresh";

import { getFlashMoves, setFlashMoves } from "#/game/cookies.ts";
import { getHeadStart, getHeadStartLength } from "#/game/flash.ts";
import { HINT_MAX_STATES, solveInWorker } from "#/game/solver-queue.ts";
import type { Move } from "#/game/types.ts";
import { trackFlashEnabled } from "#/lib/tracking.ts";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

/**
 * Turns Flash on: the puzzle starts after the opening moves of an optimal
 * solution, and stays off the leaderboard for 24 hours. POST, as it runs a solve.
 */
export const handler = define.handlers({
  async POST(ctx) {
    const { slug } = ctx.params;
    const { puzzle } = ctx.state;
    const puzzleHref = new URL(`/puzzles/${slug}`, ctx.url).href;
    const headers = new Headers({ Location: puzzleHref });

    if (slug === "preview") {
      throw new HttpError(503, "Flash not allowed on preview");
    }

    if (getHeadStartLength(puzzle.minMoves) === 0) {
      throw new HttpError(400, "Flash needs a longer puzzle");
    }

    // Already on: keep the head start it was turned on with.
    if (getFlashMoves(ctx.req.headers)) {
      return new Response(null, { headers, status: 303 });
    }

    let solution: Move[];
    try {
      solution = await solveInWorker(puzzle.board, {
        maxStates: HINT_MAX_STATES,
        signal: ctx.req.signal,
      });
    } catch {
      throw new HttpError(500, "No head start available");
    }

    const headStart = getHeadStart(solution, puzzle.minMoves);

    trackFlashEnabled(ctx.state, puzzle, {
      url: ctx.req.headers.get("referer") ?? puzzleHref,
      headStart: headStart.length,
    });

    setFlashMoves(headers, { path: `/puzzles/${slug}`, moves: headStart });

    return new Response(null, { headers, status: 303 });
  },
});
