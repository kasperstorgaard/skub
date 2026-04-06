import { define } from "#/core.ts";
import { getUser, setUser } from "#/db/user.ts";

/**
 * Reads the user record from KV in a single call and populates
 * ctx.state.theme, ctx.state.user.skillLevel, and ctx.state.email.
 * Requires auth middleware to run first.
 */
export const user = define.middleware(async (ctx) => {
  const url = new URL(ctx.req.url);

  // Skip migrations, or we get a catch-22
  if (url.pathname.startsWith("/api/migrate")) return ctx.next();

  let user = await getUser(ctx.state.userId);

  if (user) {
    ctx.state.user = user;
  } else {
    user = { id: ctx.state.userId, skillLevel: null, theme: "skub" };
    await setUser(ctx.state.userId, user);
    ctx.state.user = user;
  }

  return await ctx.next();
});
