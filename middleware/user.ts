import { define } from "#/core.ts";
import { getUser, newUser } from "#/db/user.ts";
import { updateHeaders } from "#/lib/headers.ts";
import {
  encodeProfile,
  getProfileCookie,
  getUserIdCookie,
  setProfileCookie,
} from "#/lib/user-cookie.ts";

// Logged-in devices resync from KV after this long, so devices converge.
const SYNC_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Populates ctx.state.user from the signed `profile` cookie, reading KV only
 * when the cookie is missing, belongs to another user or login, or a logged-in
 * device last synced over 30 minutes ago (so devices converge). Re-issues the
 * cookie when the user changed. Requires auth middleware to run first.
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
  const isDue = !!sessionId &&
    Date.now() - (profile?.syncedAt ?? 0) > SYNC_INTERVAL_MS;
  const isKnown = !!sessionId || !!getUserIdCookie(headers);

  let syncedAt = profile?.syncedAt;
  if (isOwnProfile && !isDue) {
    const { sessionId: _, syncedAt: __, ...user } = profile;
    ctx.state.user = user;
  } else {
    syncedAt = Date.now();
    ctx.state.user = isKnown
      ? await getUser(userId) ?? newUser(userId)
      : newUser(userId);
  }

  const res = await ctx.next();

  // A handler that set the cookie itself (logout clears it) has the last word.
  if (res.headers.getSetCookie().some((c) => c.startsWith("profile="))) {
    return res;
  }

  const payload = encodeProfile({ ...ctx.state.user, sessionId, syncedAt });
  if (isOwnProfile && payload === encodeProfile(profile)) return res;

  const cookies = new Headers();
  await setProfileCookie(cookies, payload);

  return updateHeaders(res, (headers) => {
    for (const cookie of cookies.getSetCookie()) {
      headers.append("set-cookie", cookie);
    }
  });
});
