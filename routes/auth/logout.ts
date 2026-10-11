import { define } from "#/core.ts";
import { deleteAuthSession } from "#/db/auth.ts";
import { clearProfileCookie } from "#/game/profile-cookie.ts";
import { clearAuthSessionCookie, getAuthSessionId } from "#/lib/auth-cookie.ts";
import { clearUserIdCookie } from "#/lib/user-cookie.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const sessionId = getAuthSessionId(ctx.req.headers);
    if (sessionId) await deleteAuthSession(sessionId);

    const headers = new Headers({ Location: "/profile" });
    // A full reset: the device starts over as a new anonymous visitor.
    clearAuthSessionCookie(headers);
    clearUserIdCookie(headers);
    clearProfileCookie(headers);

    return new Response(null, { status: 303, headers });
  },
});
