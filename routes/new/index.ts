import { define } from "#/core.ts";
import { BUILD_MODES, getBuildMode } from "#/game/cookies.ts";
import { isDev } from "#/lib/env.ts";

/**
 * Sends you to whichever builder you were last in. A page rather than a href
 * the CTA works out for itself: the entry point stays one stable URL, and
 * nothing linking here has to know how many builders there are.
 *
 * Namespace-neutral because it lands on tiles as readily as on puzzles.
 */
export const handler = define.handlers({
  GET(ctx) {
    const mode = getBuildMode(ctx.req.headers);

    // The tile builder writes files, so it is dev-only — sending production
    // there would be a 404 rather than a shortcut.
    const target = mode === "tile" && !isDev
      ? BUILD_MODES.build
      : BUILD_MODES[mode];

    return new Response("", {
      headers: { Location: target },
      status: 303,
    });
  },
});
