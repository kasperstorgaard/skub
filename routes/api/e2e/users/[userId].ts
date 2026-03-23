import { define } from "#/core.ts";
import { kv } from "#/db/kv.ts";
import type { Solution } from "#/db/types.ts";
import { getCanonicalMoveKey } from "#/game/strings.ts";
import { isAuthorized } from "#/routes/api/e2e/_auth.ts";

export const handler = define.handlers({
  async DELETE(ctx) {
    if (!isAuthorized(ctx.req)) {
      return new Response("Forbidden", { status: 403 });
    }

    const { userId } = ctx.params;

    // TODO: extract cascade delete into a db/users.ts deleteUser() function
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
