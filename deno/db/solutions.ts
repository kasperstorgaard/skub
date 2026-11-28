import { ulid } from "@std/ulid";

import { kv } from "#/db/kv.ts";
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
 * A Flash solve is stored the same way, marked `flash`, but needs no
 * `updateSolutionAggregates`: the leaderboard is built from those aggregates, so
 * it never shows.
 *
 * Uses an atomic transaction so all entries are written together or not at all.
 * Resolves after the commit; a new solution still needs `updateSolutionAggregates`.
 */
type SaveSolutionResult = {
  solution: Solution;
  isNew: boolean;
  isNewPath: boolean;
};

export async function saveSolution(
  payload: Omit<Solution, "id">,
): Promise<SaveSolutionResult> {
  const { puzzleSlug, moves } = payload;
  const canonicalKey = getCanonicalMoveKey(moves);
  const groupKey = [
    "solution_groups_by_puzzle",
    puzzleSlug,
    moves.length,
    canonicalKey,
  ];

  // User-level dedup: skip if this user already submitted this exact canonical path
  const [existingSolution, existingGroup] = await Promise.all([
    payload.userId
      ? getCanonicalUserSolution(payload.userId, puzzleSlug, payload)
      : null,
    kv.get<CanonicalGroup>(groupKey),
  ]);

  if (existingSolution) {
    return {
      solution: existingSolution,
      isNew: false,
      isNewPath: false,
    };
  }

  const id = ulid().toLowerCase();
  // A Flash solve isn't on the leaderboard, so it finds no new path on it.
  const claimsPath = !payload.flash && existingGroup.value === null;

  // simple key by slug for easy direct lookup
  const primaryKey = ["solutions_by_puzzle", puzzleSlug, id];

  // key for listing by canonical move set (order-independent), for dedup and panel expansion
  const byCanonicalKey = [
    "solutions_by_puzzle_canonical",
    puzzleSlug,
    canonicalKey,
    id,
  ];

  const commit = (solution: Solution, claim: boolean) => {
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

    // The first solve of a path creates its group, so exactly one finds it new.
    if (claim) {
      atomic.check(existingGroup).set(groupKey, {
        canonicalKey,
        firstSolution: solution,
        count: 1,
      });
    }
    return atomic.commit();
  };

  // Someone else claimed the path in the meantime: save without the claim.
  let solution: Solution = {
    ...payload,
    id,
    ...(claimsPath && { first: true }),
  };
  const result = await commit(solution, claimsPath);
  if (!result.ok && claimsPath) {
    solution = { ...payload, id };
    await commit(solution, false);
  }
  const isNewPath = !!solution.first;

  return {
    isNew: true,
    isNewPath,
    solution,
  };
}

/** Counts a solution in its path's group; on failure logs. */
export async function updateSolutionAggregates(solution: Solution) {
  // A first solve created its group when it was saved.
  if (solution.first) return;
  try {
    await updateCanonicalGroup(solution.puzzleSlug, solution.moves, solution);
  } catch (err) {
    console.error(
      "Failed to update solution aggregates:",
      (err as Error).message,
    );
  }
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
 * The solutions on one path of a puzzle, in the order they were found: who
 * claimed it, then who found it after. Flash solves of the same moves are
 * left out. `limit` is required, and counts before Flash solves are left out.
 */
export async function listPathSolutions(
  puzzleSlug: string,
  canonicalKey: string,
  options: { limit: number },
) {
  const solutions: Solution[] = [];
  const iter = kv.list<Solution>(
    { prefix: ["solutions_by_puzzle_canonical", puzzleSlug, canonicalKey] },
    { limit: options.limit },
  );

  for await (const res of iter) {
    if (!res.value.flash) solutions.push(res.value);
  }

  return solutions;
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
  options:
    & { limit: number | "max"; slugs?: string[] }
    & Omit<Deno.KvListOptions, "limit">,
) {
  const solutions: Solution[] = [];
  if (!options.limit) throw new Error("Must provide a limit");
  const limit = options.limit === "max" ? 10_000 : options.limit;

  const iter = kv.list<Solution>(
    { prefix: ["solutions_by_user", userId] },
    { ...options, limit },
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
 * for a given puzzle, Flash or not alike. Returns the existing solution or null.
 * Uses a list scan — fine since users post very few solutions per puzzle.
 */
async function getCanonicalUserSolution(
  userId: string,
  puzzleSlug: string,
  { moves, flash }: Pick<Solution, "moves" | "flash">,
): Promise<Solution | null> {
  const existing = await listUserPuzzleSolutions(userId, puzzleSlug, {
    limit: 100,
  });
  const canonicalKey = getCanonicalMoveKey(moves);
  return (
    existing.find((s) =>
      s.flash === flash && getCanonicalMoveKey(s.moves) === canonicalKey
    ) ?? null
  );
}

/**
 * Rewrites stored solutions under all four of their keys, 50 to a commit:
 * four copies of a long solution add up, against KV's 800 KB a commit. For
 * the migration, which marks the first solve of each path after the fact.
 */
export async function updateSolutions(solutions: Solution[]): Promise<void> {
  const atomic = kv.atomic();
  for (const solution of solutions.slice(0, 50)) {
    const { puzzleSlug, userId, id } = solution;
    const canonicalKey = getCanonicalMoveKey(solution.moves);
    atomic
      .set(["solutions_by_puzzle", puzzleSlug, id], solution)
      .set(
        ["solutions_by_puzzle_canonical", puzzleSlug, canonicalKey, id],
        solution,
      )
      .set(["solutions_by_user", userId, id], solution)
      .set(["solutions_by_user_puzzle", userId, puzzleSlug, id], solution);
  }
  await atomic.commit();
  if (solutions.length > 50) await updateSolutions(solutions.slice(50));
}
