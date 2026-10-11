import { define } from "#/core.ts";
import { listUserSolutions } from "#/db/solutions.ts";
import type { User } from "#/db/types.ts";
import { getUser, newUser } from "#/db/user.ts";
import {
  encodeProfile,
  getProfileCookie,
  setProfileCookie,
  signProfile,
} from "#/game/profile-cookie.ts";
import {
  getProgressCookie,
  setProgressCookie,
  signProgress,
} from "#/game/progress-cookie.ts";
import { getProgress } from "#/game/progress.ts";
import { updateHeaders } from "#/lib/headers.ts";
import { getUserIdCookie } from "#/lib/user-cookie.ts";

// Logged-in devices resync from KV after this long, so devices converge.
const SYNC_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Populates ctx.state.user and ctx.state.progress from the signed `profile`
 * and `progress` cookies, reading KV only when a cookie is missing, belongs to
 * another user or login, or a logged-in device last synced over 30 minutes ago
 * (so devices converge). Re-issues the cookies when they changed. Requires
 * auth middleware to run first.
 */
export const user = define.middleware(async (ctx) => {
  const url = new URL(ctx.req.url);

  // /api/migrate is added temporarily for migrations; keep this skip.
  if (url.pathname.startsWith("/api/migrate")) return ctx.next();

  const { userId, sessionId } = ctx.state;
  const { headers } = ctx.req;

  const [profile, cookieProgress] = await Promise.all([
    getProfileCookie(ctx.req),
    getProgressCookie(ctx.req, userId),
  ]);
  const isOwnLogin = profile?.sessionId === sessionId;
  const isOwnProfile = profile?.id === userId && isOwnLogin;
  const syncAge = Date.now() - (profile?.syncedAt ?? 0);
  const isDue = !!sessionId && syncAge > SYNC_INTERVAL_MS;
  const isFresh = isOwnProfile && !isDue;
  const isKnown = !!sessionId || !!getUserIdCookie(headers);

  // Progress resyncs with the profile, in the same round trip.
  const [stored, solutions] = await Promise.all([
    !isFresh && isKnown ? getUser(userId) : null,
    isKnown && (!isFresh || !cookieProgress)
      ? listUserSolutions(userId, { limit: "max" })
      : null,
  ]);

  let syncedAt = profile?.syncedAt;
  let user: User;
  if (isFresh) {
    // Strip the cookie-only fields; the rest is the user record.
    const { sessionId: _, syncedAt: __, ...profileUser } = profile;
    user = profileUser;
  } else {
    syncedAt = Date.now();
    user = stored ?? newUser(userId);
  }
  const progress = solutions ? getProgress(solutions) : cookieProgress ?? {};

  ctx.state.user = user;
  ctx.state.progress = progress;

  const res = await ctx.next();

  // A write (setUser) read KV just now, so the device is in sync again.
  if (ctx.state.user !== user) syncedAt = Date.now();

  // A handler that set a cookie itself (logout clears them) has the last word.
  const cookiesSet = res.headers.getSetCookie();
  const isSet = (name: string) =>
    cookiesSet.some((cookie) => cookie.startsWith(`${name}=`));

  let profileValue: string | null = null;
  const payload = encodeProfile({ ...ctx.state.user, sessionId, syncedAt });
  const isProfileSame = isOwnProfile && payload === encodeProfile(profile);
  if (!isSet("profile") && !isProfileSame) {
    profileValue = await signProfile(payload);
  }

  let progressValue: string | null = null;
  const isProgressSame = cookieProgress && !solutions &&
    ctx.state.progress === progress;
  if (!isSet("progress") && !isProgressSame) {
    progressValue = await signProgress(ctx.state.progress, userId);
  }

  if (!profileValue && !progressValue) return res;

  return updateHeaders(res, (headers) => {
    if (profileValue) setProfileCookie(headers, profileValue);
    if (progressValue) setProgressCookie(headers, progressValue);
  });
});
