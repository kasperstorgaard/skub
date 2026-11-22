import { define } from "#/core.ts";
import { rawKv } from "#/db/kv.ts";
import { isAuthorized } from "#/routes/api/e2e/_auth.ts";

const TIMELINE = Deno.env.get("DENO_TIMELINE") ?? null;
const BUILD_ID = Deno.env.get("DENO_DEPLOY_BUILD_ID") ?? null;

// KV caps mutations per atomic commit.
const DELETES_PER_COMMIT = 500;

export const handler = define.handlers({
  async POST(ctx) {
    if (!isAuthorized(ctx.req)) {
      return new Response("Forbidden", { status: 403 });
    }
    // Only branch timelines (own database) or local dev.
    if (TIMELINE !== null && !TIMELINE.startsWith("git-branch/")) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const entries = await Array.fromAsync(rawKv.list({ prefix: [] }));
      for (let i = 0; i < entries.length; i += DELETES_PER_COMMIT) {
        const op = rawKv.atomic();
        for (const { key } of entries.slice(i, i + DELETES_PER_COMMIT)) {
          op.delete(key);
        }
        await op.commit();
      }
    } catch (err) {
      console.error("e2e reset failed", err);
      return new Response("Reset failed", { status: 500 });
    }

    return Response.json({ timeline: TIMELINE, buildId: BUILD_ID });
  },
});
