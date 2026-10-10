import { define } from "#/core.ts";
import { getUser, newUser } from "#/db/user.ts";
import { updateHeaders } from "#/lib/headers.ts";
import {
  encodeProfile,
  getProfileCookie,
  getUserIdCookie,
  hasSessionCookie,
  setProfileCookie,
  setSessionCookie,
} from "#/lib/user-cookie.ts";

/**
 * Populates ctx.state.user from the signed `profile` cookie, reading KV only
 * when the cookie is missing, belongs to another user or login, or a logged-in
 * device starts a session (so devices converge). Re-issues the cookie when the user
 * changed. Requires auth middleware to run first.
 */
export const user = define.middleware(async (ctx) => {
  const url = new URL(ctx.req.url);

  // /api/migrate is added temporarily for migrations; keep this skip.
  if (url.pathname.startsWith("/api/migrate")) return ctx.next();

  const { userId, sessionId } = ctx.state;
  const { headers } = ctx.req;

  const profile = await getProfileCookie(ctx.req);
  const isOwnProfile = profile?.id === userId &&
    profile.sessionId === sessionId;
  const isSessionStart = !!sessionId && !hasSessionCookie(headers);
  const isKnown = !!sessionId || !!getUserIdCookie(headers);

  if (isOwnProfile && !isSessionStart) {
    const { sessionId: _, ...user } = profile;
    ctx.state.user = user;
  } else {
    ctx.state.user = isKnown
      ? await getUser(userId) ?? newUser(userId)
      : newUser(userId);
  }

  const res = await ctx.next();

  const payload = encodeProfile({ ...ctx.state.user, sessionId });
  const isStale = !isOwnProfile || payload !== encodeProfile(profile);

  if (!isStale && !sessionId) return res;

  const profileHeaders = new Headers();
  if (isStale) await setProfileCookie(profileHeaders, payload);
  if (sessionId) setSessionCookie(profileHeaders);

  return updateHeaders(res, (headers) => {
    for (const cookie of profileHeaders.getSetCookie()) {
      headers.append("set-cookie", cookie);
    }
  });
});
