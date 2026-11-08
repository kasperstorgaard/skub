import { kv } from "#/db/kv.ts";
import { User } from "#/db/types.ts";
import { normalizeBoard } from "#/game/board.ts";
import type { Puzzle } from "#/game/types.ts";

export async function getUser(userId: string): Promise<User | null> {
  const res = await kv.get<User>(["user", userId]);
  if (!res.value) return null;
  return { ...res.value, id: userId };
}

/** Names by user id, for the users that picked one. */
export async function getUserNames(
  userIds: string[],
): Promise<Map<string, string>> {
  // getMany takes ten keys at most.
  const batches = [];
  for (let i = 0; i < userIds.length; i += 10) {
    batches.push(
      kv.getMany<User[]>(
        userIds.slice(i, i + 10).map((userId) => ["user", userId]),
      ),
    );
  }

  const names = new Map<string, string>();
  for (const entries of await Promise.all(batches)) {
    for (const { key, value } of entries) {
      if (value?.name) names.set(key[1] as string, value.name);
    }
  }
  return names;
}

/** Defaults for a visitor with no record. Not stored until the first write. */
export function newUser(userId: string): User {
  return { id: userId, skillLevel: null, theme: "skub" };
}

/**
 * Merges `patch` into the stored record and returns the result. Reads first:
 * the request's copy can be behind another device, and writing it back would
 * undo that device's changes.
 */
export async function setUser(
  userId: string,
  patch: Partial<Omit<User, "id">>,
): Promise<User> {
  const existing = await getUser(userId) ?? newUser(userId);
  const updated = { ...existing, ...patch };
  await kv.set(["user", userId], updated);
  return updated;
}

/**
 * A board that has only just been started. It carries no name: a board earns
 * one when it becomes a candidate, so until then there is nothing to call it.
 * Nothing is on the board either — a destination in the corner is something the
 * builder then has to notice and undo.
 */
export function newPuzzleDraft(): Puzzle {
  return {
    number: 0,
    name: "",
    slug: "",
    createdAt: new Date(Date.now()),
    difficulty: "medium",
    minMoves: 0,
    board: {
      destination: undefined,
      pieces: [],
      walls: [],
      holes: [],
      portals: [],
    },
  };
}

export async function getUserPuzzleDraft(
  userId: string,
): Promise<Puzzle | null> {
  const res = await kv.get<Puzzle>(["user", userId, "puzzle_draft"]);
  if (!res.value) return null;

  return { ...res.value, board: normalizeBoard(res.value.board) };
}

export async function setUserPuzzleDraft(
  userId: string,
  puzzle: Puzzle,
): Promise<void> {
  await kv.set(["user", userId, "puzzle_draft"], puzzle);
}
