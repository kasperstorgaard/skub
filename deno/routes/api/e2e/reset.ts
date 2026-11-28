import { define } from "#/core.ts";
import { rawKv } from "#/db/kv.ts";
import { isAuthorized } from "#/routes/api/e2e/_auth.ts";

const TIMELINE = Deno.env.get("DENO_TIMELINE") ?? null;
const BUILD_ID = Deno.env.get("DENO_DEPLOY_BUILD_ID") ?? null;

export const handler = define.handlers({
  async POST(ctx) {
    if (!isAuthorized(ctx.req)) {
      return new Response("Forbidden", { status: 403 });
    }
    // Only branch timelines (own database) or local dev.
    if (TIMELINE !== null && !TIMELINE.startsWith("git-branch/")) {
      return new Response("Forbidden", { status: 403 });
    }

    const entries = await Array.fromAsync(rawKv.list({ prefix: [] }));
    await Promise.all(entries.map(({ key }) => rawKv.delete(key)));

    return Response.json({ timeline: TIMELINE, buildId: BUILD_ID });
  },
});
