import { define } from "#/core.ts";
import type { User } from "#/db/types.ts";
import { getUser, newUser } from "#/db/user.ts";
import {
  encodeProfile,
  getProfileCookie,
  setProfileCookie,
  signProfile,
} from "#/game/profile-cookie.ts";
import { updateHeaders } from "#/lib/headers.ts";
import { getUserIdCookie } from "#/lib/user-cookie.ts";

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
  const isOwnLogin = profile?.sessionId === sessionId;
  const isOwnProfile = profile?.id === userId && isOwnLogin;
  const syncAge = Date.now() - (profile?.syncedAt ?? 0);
  const isDue = !!sessionId && syncAge > SYNC_INTERVAL_MS;
  const isKnown = !!sessionId || !!getUserIdCookie(headers);

  let syncedAt = profile?.syncedAt;
  let user: User;
  if (isOwnProfile && !isDue) {
    // Strip the cookie-only fields; the rest is the user record.
    const { sessionId: _, syncedAt: __, ...profileUser } = profile;
    user = profileUser;
  } else {
    syncedAt = Date.now();
    const stored = isKnown ? await getUser(userId) : null;
    user = stored ?? newUser(userId);
  }
  ctx.state.user = user;

  const res = await ctx.next();

  // A write (setUser) read KV just now, so the device is in sync again.
  if (ctx.state.user !== user) syncedAt = Date.now();

  // A handler that set the cookie itself (logout clears it) has the last word.
  const cookiesSet = res.headers.getSetCookie();
  if (cookiesSet.some((cookie) => cookie.startsWith("profile="))) return res;

  const payload = encodeProfile({ ...ctx.state.user, sessionId, syncedAt });
  if (isOwnProfile && payload === encodeProfile(profile)) return res;

  const value = await signProfile(payload);
  if (!value) return res;

  return updateHeaders(res, (headers) => setProfileCookie(headers, value));
});
