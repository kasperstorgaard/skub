import { define } from "#/core.ts";
import { getUser, newUser } from "#/db/user.ts";

/**
 * Reads the user record into ctx.state.user, falling back to defaults without
 * writing. Requires auth middleware to run first.
 */
export const user = define.middleware(async (ctx) => {
  const url = new URL(ctx.req.url);

  // Skip migrations, or we get a catch-22. /api/migrate is added temporarily
  // when a migration runs; keep this guard when it's absent.
  if (url.pathname.startsWith("/api/migrate")) return ctx.next();

  ctx.state.user = await getUser(ctx.state.userId) ?? newUser(ctx.state.userId);
  return await ctx.next();
});
