import type { BrowserContext } from "playwright";

import type { Solution } from "#/db/types.ts";
import { getCanonicalMoveKey } from "#/game/strings.ts";

export const BASE_URL = Deno.env.get("BASE_URL") ?? "http://localhost:5173";

/**
 * Seeds a named user directly into KV (bypasses the HTTP layer).
 * Uses the same key schema as db/user.ts: ["user", userId].
 */
export async function seedNamedUser(userId: string, name: string) {
  const kv = await Deno.openKv();
  await kv.set(["user", userId], { name, onboarding: "done" });
  await kv.close();
}

/**
 * Deletes all KV entries for the given test user: user record, all solution
 * indexes (user-scoped and global). Idempotent.
 */
export async function clearTestUser(userId: string) {
  const kv = await Deno.openKv();

  // Collect user-scoped solutions before deleting, so we can clean global indexes too
  const solutions: Solution[] = [];
  const byUserIter = kv.list<Solution>({ prefix: ["solutions_by_user", userId] });
  for await (const entry of byUserIter) {
    solutions.push(entry.value);
    await kv.delete(entry.key);
  }

  const byUserPuzzleIter = kv.list({ prefix: ["solutions_by_user_puzzle", userId] });
  for await (const entry of byUserPuzzleIter) await kv.delete(entry.key);

  // Delete user record
  const userIter = kv.list({ prefix: ["user", userId] });
  for await (const entry of userIter) await kv.delete(entry.key);

  // Delete global solution indexes for this user's solutions
  for (const solution of solutions) {
    await kv.delete(["solutions_by_puzzle", solution.puzzleSlug, solution.id]);
    const canonicalKey = getCanonicalMoveKey(solution.moves);
    await kv.delete([
      "solutions_by_puzzle_canonical",
      solution.puzzleSlug,
      canonicalKey,
      solution.id,
    ]);
    // Delete the canonical group aggregate so stale firstSolution data doesn't
    // persist across test runs and cause name-lookup failures on the solutions page.
    await kv.delete([
      "solution_groups_by_puzzle",
      solution.puzzleSlug,
      solution.moves.length,
      canonicalKey,
    ]);
  }

  await kv.close();
}

/**
 * Adds the user_id cookie to a Playwright browser context so the server
 * can look up the seeded user record.
 */
export async function addUserCookie(context: BrowserContext, userId: string) {
  await context.addCookies([{
    name: "user_id",
    value: userId,
    domain: "localhost",
    path: "/",
    httpOnly: true,
  }]);
}
