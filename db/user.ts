import { kv } from "#/db/kv.ts";
import { User } from "#/db/types.ts";
import { normalizeBoard } from "#/game/board.ts";
import type { Puzzle } from "#/game/types.ts";

export async function getUser(userId: string): Promise<User | null> {
  const res = await kv.get<User>(["user", userId]);
  if (!res.value) return null;
  return { ...res.value, id: userId };
}

/**
 * Merges a partial update into the existing user record.
 * Creates a new record with defaults if none exists.
 */
export async function setUser(
  userId: string,
  patch: Partial<Omit<User, "id">>,
): Promise<void> {
  const existing = (await kv.get<User>(["user", userId])).value ?? {};
  await kv.set(["user", userId], { ...existing, ...patch });
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
