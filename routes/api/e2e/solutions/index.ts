import { define } from "#/core.ts";
import { saveSolution } from "#/db/solutions.ts";
import type { Solution } from "#/db/types.ts";
import { isAuthorized } from "#/routes/api/e2e/_auth.ts";

export const handler = define.handlers({
  async POST(ctx) {
    if (!isAuthorized(ctx.req)) {
      return new Response("Forbidden", { status: 403 });
    }

    let body: Omit<Solution, "id">;
    try {
      body = await ctx.req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (!body.puzzleSlug || !body.moves?.length || !body.name) {
      return new Response("Missing puzzleSlug, name, or moves", {
        status: 400,
      });
    }

    const { isNew, solution } = await saveSolution(body);

    if (!isNew) {
      return new Response("Duplicate solution", { status: 409 });
    }

    return Response.json(solution);
  },
});
