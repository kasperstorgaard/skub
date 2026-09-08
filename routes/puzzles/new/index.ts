import { define } from "#/core.ts";
import { BUILD_MODES, getBuildMode } from "#/game/cookies.ts";

/**
 * Sends you to whichever puzzle builder you were last in. A page rather than a
 * href the CTA works out for itself: the entry point stays one stable URL, and
 * nothing linking here has to know how many builders there are.
 */
export const handler = define.handlers({
  GET(ctx) {
    return new Response("", {
      headers: { Location: BUILD_MODES[getBuildMode(ctx.req.headers)] },
      status: 303,
    });
  },
});
