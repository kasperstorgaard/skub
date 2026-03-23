import { define } from "#/core.ts";
import type { User } from "#/db/types.ts";
import { setUser } from "#/db/user.ts";
import { isAuthorized } from "#/routes/api/e2e/_auth.ts";

export const handler = define.handlers({
  async POST(ctx) {
    if (!isAuthorized(ctx.req)) {
      return new Response("Forbidden", { status: 403 });
    }

    let body: Partial<User> & { name: string };
    try {
      body = await ctx.req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (!body.name) {
      return new Response("Missing name", { status: 400 });
    }

    const user: User = {
      ...body,
      onboarding: body.onboarding ?? "done",
      id: body.id ?? crypto.randomUUID(),
    };

    await setUser(user.id, user);

    return Response.json(user);
  },
});
