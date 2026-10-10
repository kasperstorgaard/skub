import { trace } from "@opentelemetry/api";

import { define } from "#/core.ts";
import { getAuthSession } from "#/db/auth.ts";
import { getAuthSessionId } from "#/lib/auth-cookie.ts";
import { updateHeaders } from "#/lib/headers.ts";
import {
  getProfileCookie,
  getUserIdCookie,
  setUserIdCookie,
} from "#/lib/user-cookie.ts";

/**
 * Establishes user identity for every request.
 * Priority: authenticated session > existing anonymous cookie > new visitor.
 */
export const auth = define.middleware(async (ctx) => {
  const url = new URL(ctx.req.url);

  // /api/migrate is added temporarily for migrations; keep this skip.
  if (url.pathname.startsWith("/api/migrate")) return ctx.next();

  const sessionId = getAuthSessionId(ctx.req.headers);
  const sessionUserId = sessionId
    ? await getSessionUserId(ctx.req, sessionId)
    : undefined;
  if (sessionUserId) ctx.state.sessionId = sessionId;

  let userId = sessionUserId ?? getUserIdCookie(ctx.req.headers);
  const isNew = !userId;
  if (!userId) userId = crypto.randomUUID();

  ctx.state.userId = userId;
  trace.getActiveSpan()?.setAttribute("user.id", userId);

  const response = await ctx.next();

  if (!isNew) return response;
  return updateHeaders(response, (headers) => setUserIdCookie(headers, userId));
});

/** The session's user id: from the signed profile when it vouches for this session, else KV. */
async function getSessionUserId(req: Request, sessionId: string) {
  const profile = await getProfileCookie(req);
  if (profile?.sessionId === sessionId) return profile.id;

  return (await getAuthSession(sessionId))?.userId;
}
