import { define } from "#/core.ts";
import { kv } from "#/db/kv.ts";
import type { User } from "#/db/types.ts";
import { isAuthorized } from "#/routes/api/e2e/_auth.ts";

export const handler = define.handlers({
  async POST(ctx) {
    if (!isAuthorized(ctx.req)) {
      return new Response("Forbidden", { status: 403 });
    }

    let body: Partial<Omit<User, "id">> & { name: string };
    try {
      body = await ctx.req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (!body.name) {
      return new Response("Missing name", { status: 400 });
    }

    const user: User = {
      onboarding: "done",
      ...body,
      id: crypto.randomUUID(),
    };
    await kv.set(["user", user.id], user);

    return Response.json(user);
  },
});
