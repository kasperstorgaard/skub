import { HttpError } from "fresh";

import { getFlashStart, setFlashStart } from "#/game/cookies.ts";
import { trackFlashEnabled } from "#/lib/tracking.ts";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

/**
 * Turns Flash on: the puzzle starts at its Flash start and stays off the
 * leaderboard for 24 hours. POST, as it changes how the puzzle plays.
 */
export const handler = define.handlers({
  POST(ctx) {
    const { slug } = ctx.params;
    const { puzzle } = ctx.state;
    const puzzleHref = new URL(`/puzzles/${slug}`, ctx.url).href;
    const headers = new Headers({ Location: puzzleHref });

    if (!puzzle.flashStart) {
      throw new HttpError(400, "No Flash for this puzzle");
    }

    // Already on: keep the start it was turned on with.
    if (getFlashStart(ctx.req.headers)) {
      return new Response(null, { headers, status: 303 });
    }

    trackFlashEnabled(ctx.state, puzzle, {
      url: ctx.req.headers.get("referer") ?? puzzleHref,
      flashStartLength: puzzle.flashStart.length,
    });

    setFlashStart(headers, {
      path: `/puzzles/${slug}`,
      flashStart: puzzle.flashStart,
    });

    return new Response(null, { headers, status: 303 });
  },
});
