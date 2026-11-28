import { define } from "#/core.ts";
import {
  deleteTrackingCookie,
  generateTrackingId,
  setTrackingCookie,
} from "#/game/cookies.ts";
import { trackCookieConsent } from "#/lib/tracking.ts";

/**
 * Handles cookie consent form submissions from the CookieBanner.
 *
 * POST /api/consent
 * - action=accept: Generates new tracking ID and sets cookie
 * - action=decline: Sets cookie to "declined"
 * - action=reset: Clears the cookie, so the banner asks again
 *
 * Redirects back to the referring page after setting the cookie.
 */
export const handler = define.handlers({
  async POST(ctx) {
    const formData = await ctx.req.formData();
    const action = formData.get("action");
    const referer = ctx.req.headers.get("referer") || "/";

    const headers = new Headers();
    headers.set("Location", referer);

    if (action === "reset") {
      deleteTrackingCookie(headers);
      return new Response("", { status: 303, headers });
    }

    // If users accepts cookies, generate a new tracking id.
    // If not, set cookie to "declined" to avoid asking again.
    const isAllowed = action === "accept";
    const trackingId = generateTrackingId();

    ctx.state.trackingId = trackingId;
    setTrackingCookie(headers, isAllowed ? trackingId : "declined");

    trackCookieConsent(ctx.state, {
      decision: isAllowed ? "accepted" : "declined",
      url: referer,
    });

    return new Response("", {
      status: 303,
      headers,
    });
  },
});
