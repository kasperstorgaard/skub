import { HttpError } from "fresh";

import {
  getFlashStart,
  setFlashExplained,
  setFlashStart,
} from "#/game/cookies.ts";
import { trackFlashEnabled } from "#/lib/tracking.ts";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

/**
 * Turns Flash on, or answers its dialog. Turning Flash on starts the puzzle at
 * its Flash start and keeps it off the leaderboard for 24 hours; "Not now"
 * changes nothing else. Either way Flash counts as explained on every puzzle:
 * no more dialog, no more nudge.
 */
export const handler = define.handlers({
  async POST(ctx) {
    const { slug } = ctx.params;
    const { puzzle } = ctx.state;
    const form = await ctx.req.formData();

    const headers = new Headers();
    setFlashExplained(headers);

    if (form.get("answer") === "not-now") {
      if (ctx.req.headers.get("accept")?.includes("application/json")) {
        return new Response(null, { headers, status: 204 });
      }

      // Back to the game as it was, without the dialog.
      const back = new URL(`/puzzles/${slug}`, ctx.url);
      back.search = form.get("search")?.toString() ?? "";
      back.searchParams.delete("dialog");
      headers.set("Location", back.href);
      return new Response(null, { headers, status: 303 });
    }

    if (!puzzle.flashStart) {
      throw new HttpError(400, "No Flash for this puzzle");
    }

    const puzzleHref = new URL(`/puzzles/${slug}`, ctx.url).href;
    headers.set("Location", puzzleHref);

    // Already on: keep the start it was turned on with.
    if (getFlashStart(ctx.req.headers)) {
      return new Response(null, { headers, status: 303 });
    }

    trackFlashEnabled(ctx.state, puzzle, {
      url: ctx.req.headers.get("referer") ?? puzzleHref,
      flashStartLength: puzzle.flashStart.length,
      flashMode: "manual",
    });

    setFlashStart(headers, {
      path: `/puzzles/${slug}`,
      flashStart: puzzle.flashStart,
    });

    return new Response(null, { headers, status: 303 });
  },
});
