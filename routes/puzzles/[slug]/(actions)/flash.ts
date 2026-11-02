import { HttpError } from "fresh";

import { getFlashMoves, setFlashMoves } from "#/game/cookies.ts";
import { getHeadStart, getHeadStartLength } from "#/game/flash.ts";
import { HINT_MAX_STATES, solveInWorker } from "#/game/solver-queue.ts";
import type { Move } from "#/game/types.ts";
import { getFlashStartHref } from "#/game/url.ts";
import { trackFlashEnabled } from "#/lib/tracking.ts";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

/**
 * Turns Flash on: plays the opening moves of an optimal solution and keeps the
 * puzzle off the leaderboard for 24 hours. POST, as it runs a solve.
 */
export const handler = define.handlers({
  async POST(ctx) {
    const { slug } = ctx.params;
    const { puzzle } = ctx.state;
    const puzzleHref = new URL(`/puzzles/${slug}`, ctx.url).href;

    if (slug === "preview") {
      throw new HttpError(503, "Flash not allowed on preview");
    }

    if (getHeadStartLength(puzzle.minMoves) === 0) {
      throw new HttpError(400, "Flash needs a longer puzzle");
    }

    // Already on: back to the head start it was turned on with.
    const current = getFlashMoves(ctx.req.headers);
    if (current) {
      return new Response(null, {
        status: 303,
        headers: { Location: getFlashStartHref(puzzleHref, current) },
      });
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

    const headers = new Headers({
      Location: getFlashStartHref(puzzleHref, headStart),
    });
    setFlashMoves(headers, { path: `/puzzles/${slug}`, moves: headStart });

    return new Response(null, { headers, status: 303 });
  },
});
