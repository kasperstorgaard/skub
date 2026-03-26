import { ulid } from "@std/ulid";

import { kv } from "#/db/kv.ts";
import { updatePuzzleStats } from "#/db/stats.ts";
import { CanonicalGroup, Solution } from "#/db/types.ts";
import { getCanonicalMoveKey } from "#/game/strings.ts";
import { Move } from "#/game/types.ts";

/**
 * Saves a human-submitted solution, deduplicating by canonical move set per user.
 * Returns `isNew: false` immediately if this user has already submitted the same path.
 *
 * Stores under two index keys (plus two user-scoped keys when userId is present):
 * - by puzzle slug (direct lookup)
 * - by puzzle slug + canonical move key (order-independent, for dedup)
 * - by user (user history)
 * - by user + puzzle slug (user's attempts at a specific puzzle)
 *
 * Uses an atomic transaction so all entries are written together or not at all.
 * Awaits aggregate updates (stats, canonical group) before returning — errors are logged but not re-thrown.
 */
type SaveSolutionResult =
  | { isNew: true; isNewPath: boolean; solution: Solution }
  | { isNew: false };

export async function saveSolution(
  payload: Omit<Solution, "id">,
): Promise<SaveSolutionResult> {
  const { puzzleSlug, moves } = payload;

  // User-level dedup: skip if this user already submitted this exact canonical path
  if (payload.userId) {
    const userExisting = await getCanonicalUserSolution(
      payload.userId,
      puzzleSlug,
      moves,
    );
    if (userExisting) return { isNew: false };
  }

  const id = ulid().toLowerCase();
  const solution = { ...payload, id };
  const canonicalKey = getCanonicalMoveKey(moves);

  // Check if this canonical path already exists
  const groupKey = [
    "solution_groups_by_puzzle",
    puzzleSlug,
    moves.length,
    canonicalKey,
  ];
  const existingGroup = await kv.get<CanonicalGroup>(groupKey);
  const isNewPath = existingGroup.value === null;

  // simple key by slug for easy direct lookup
  const primaryKey = ["solutions_by_puzzle", puzzleSlug, id];

  // key for listing by canonical move set (order-independent), for dedup and panel expansion
  const byCanonicalKey = [
    "solutions_by_puzzle_canonical",
    puzzleSlug,
    canonicalKey,
    id,
  ];

  // publicly available keys
  const atomic = kv.atomic()
    .check({ key: primaryKey, versionstamp: null })
    .check({ key: byCanonicalKey, versionstamp: null })
    .set(primaryKey, solution)
    .set(byCanonicalKey, solution);

  // user-scoped keys
  const byUserKey = ["solutions_by_user", payload.userId, id];
  const byUserPuzzleKey = [
    "solutions_by_user_puzzle",
    payload.userId,
    puzzleSlug,
    id,
  ];

  atomic
    .check({ key: byUserKey, versionstamp: null })
    .check({ key: byUserPuzzleKey, versionstamp: null })
    .set(byUserKey, solution)
    .set(byUserPuzzleKey, solution);

  await atomic.commit();

  try {
    await Promise.all([
      updatePuzzleStats(puzzleSlug, moves.length, payload.userId),
      updateCanonicalGroup(puzzleSlug, moves, solution),
    ]);
  } catch (err) {
    console.error(
      "Failed to update solution aggregates:",
      (err as Error).message,
    );
  }

  return { isNew: true, isNewPath, solution };
}

/**
 * Lists human-submitted solutions for a puzzle in insertion order.
 * `limit` is required.
 */
export async function listPuzzleSolutions(
  puzzleSlug: string,
  options: { limit: number } & Omit<Deno.KvListOptions, "limit">,
) {
  const solutions: Solution[] = [];
  if (!options.limit) throw new Error("Must provide a limit");

  const iter = kv.list<Solution>(
    { prefix: ["solutions_by_puzzle", puzzleSlug] },
    options,
  );

  for await (const res of iter) solutions.push(res.value);

  return solutions;
}

/**
 * Lists canonical groups for a puzzle, ordered by move count (fewest first).
 * Each entry represents a unique set of moves with a count of how many solutions share it.
 * `limit` is required.
 */
export async function listCanonicalGroups(
  puzzleSlug: string,
  options: { limit: number } & Omit<Deno.KvListOptions, "limit">,
) {
  const groups: CanonicalGroup[] = [];
  if (!options.limit) throw new Error("Must provide a limit");

  const iter = kv.list<CanonicalGroup>(
    { prefix: ["solution_groups_by_puzzle", puzzleSlug] },
    options,
  );

  for await (const res of iter) groups.push(res.value);

  return groups;
}

/**
 * Updates the canonical group aggregate for a puzzle after a new solution is added.
 * Creates the group entry if absent; increments count if present.
 * Retries up to 5 times on optimistic concurrency conflicts.
 */
async function updateCanonicalGroup(
  puzzleSlug: string,
  moves: Move[],
  solution: Solution,
): Promise<void> {
  const canonicalKey = getCanonicalMoveKey(moves);
  const key = [
    "solution_groups_by_puzzle",
    puzzleSlug,
    moves.length,
    canonicalKey,
  ];

  for (let attempt = 1; attempt <= 5; attempt++) {
    const current = await kv.get<CanonicalGroup>(key);

    const updated: CanonicalGroup = current.value
      ? { ...current.value, count: current.value.count + 1 }
      : { canonicalKey, firstSolution: solution, count: 1 };

    const result = await kv.atomic().check(current).set(key, updated).commit();
    if (result.ok) return;
  }

  throw new Error(`Failed to update canonical group after 5 attempts`);
}

/**
 * Lists all solutions submitted by a specific user, in insertion order.
 * `limit` is required.
 */
export async function listUserSolutions(
  userId: string,
  options: { limit: number } & Omit<Deno.KvListOptions, "limit">,
) {
  const solutions: Solution[] = [];
  if (!options.limit) throw new Error("Must provide a limit");

  const iter = kv.list<Solution>(
    { prefix: ["solutions_by_user", userId] },
    options,
  );

  for await (const res of iter) solutions.push(res.value);

  return solutions;
}

/**
 * Lists all solutions submitted by a specific user for a specific puzzle, in insertion order.
 * `limit` is required.
 */
export async function listUserPuzzleSolutions(
  userId: string,
  puzzleSlug: string,
  options: { limit: number } & Omit<Deno.KvListOptions, "limit">,
) {
  const solutions: Solution[] = [];
  if (!options.limit) throw new Error("Must provide a limit");

  const iter = kv.list<Solution>(
    { prefix: ["solutions_by_user_puzzle", userId, puzzleSlug] },
    options,
  );

  for await (const res of iter) solutions.push(res.value);

  return solutions;
}

/**
 * Fetches the canonical group for a given solution.
 * Returns `null` if not found.
 */
export async function getCanonicalGroup(
  solution: Solution,
): Promise<CanonicalGroup | null> {
  const canonicalKey = getCanonicalMoveKey(solution.moves);
  const key = [
    "solution_groups_by_puzzle",
    solution.puzzleSlug,
    solution.moves.length,
    canonicalKey,
  ];
  const res = await kv.get<CanonicalGroup>(key);
  return res.value;
}

/**
 * Fetches a single human-submitted solution by puzzle slug and solution ID.
 * Returns `null` if not found.
 */
export async function getPuzzleSolution(
  puzzleSlug: string,
  solutionId: string,
) {
  const key = ["solutions_by_puzzle", puzzleSlug, solutionId];
  const res = await kv.get<Solution>(key);

  return res.value;
}

/**
 * Checks whether a user already has a solution with the same canonical move set
 * for a given puzzle. Returns the existing solution or null.
 * Uses a list scan — fine since users post very few solutions per puzzle.
 */
async function getCanonicalUserSolution(
  userId: string,
  puzzleSlug: string,
  moves: Move[],
): Promise<Solution | null> {
  const existing = await listUserPuzzleSolutions(userId, puzzleSlug, {
    limit: 100,
  });
  const canonicalKey = getCanonicalMoveKey(moves);
  return (
    existing.find((s) => getCanonicalMoveKey(s.moves) === canonicalKey) ?? null
  );
}

/**
 * Returns the best (fewest) move count per puzzle slug from a list of solutions.
 */
export function getBestMoves(
  solutions: Solution[],
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const solution of solutions) {
    const current = result[solution.puzzleSlug];
    if (current === undefined || solution.moves.length < current) {
      result[solution.puzzleSlug] = solution.moves.length;
    }
  }

  return result;
}
