import { define } from "#/core.ts";
import { kv } from "#/db/kv.ts";
import type { Solution, User } from "#/db/types.ts";
import { getCanonicalMoveKey } from "#/game/strings.ts";

const E2E_SECRET = Deno.env.get("E2E_SECRET");

function isAuthorized(req: Request): boolean {
  if (!E2E_SECRET) return false;
  if (new URL(req.url).hostname === "skub.app") return false;
  return req.headers.get("x-e2e-secret") === E2E_SECRET;
}

export const handler = define.handlers({
  async POST(ctx) {
    if (!isAuthorized(ctx.req)) {
      return new Response("Forbidden", { status: 403 });
    }

    let body: { userId: string; name: string };
    try {
      body = await ctx.req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { userId, name } = body;
    if (!userId || !name) {
      return new Response("Missing userId or name", { status: 400 });
    }

    const user: User = { id: userId, name, onboarding: "done" };
    await kv.set(["user", userId], user);

    return new Response("OK", { status: 200 });
  },

  async DELETE(ctx) {
    if (!isAuthorized(ctx.req)) {
      return new Response("Forbidden", { status: 403 });
    }

    let body: { userId: string };
    try {
      body = await ctx.req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { userId } = body;
    if (!userId) {
      return new Response("Missing userId", { status: 400 });
    }

    // Collect user-scoped solutions before deleting, so we can clean global indexes too
    const solutions: Solution[] = [];

    const byUserIter = kv.list<Solution>({
      prefix: ["solutions_by_user", userId],
    });
    for await (const entry of byUserIter) {
      solutions.push(entry.value);
      await kv.delete(entry.key);
    }

    const byUserPuzzleIter = kv.list({
      prefix: ["solutions_by_user_puzzle", userId],
    });
    for await (const entry of byUserPuzzleIter) {
      await kv.delete(entry.key);
    }

    await kv.delete(["user", userId]);

    // Delete global indexes for this user's solutions
    for (const solution of solutions) {
      await kv.delete([
        "solutions_by_puzzle",
        solution.puzzleSlug,
        solution.id,
      ]);

      const canonicalKey = getCanonicalMoveKey(solution.moves);
      await kv.delete([
        "solutions_by_puzzle_canonical",
        solution.puzzleSlug,
        canonicalKey,
        solution.id,
      ]);
      await kv.delete([
        "solution_groups_by_puzzle",
        solution.puzzleSlug,
        solution.moves.length,
        canonicalKey,
      ]);
    }

    return new Response("OK", { status: 200 });
  },
});
