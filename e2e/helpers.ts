import type { BrowserContext } from "playwright";

import type { Solution, User } from "#/db/types.ts";
import { getPuzzle } from "#/game/loader.ts";
import { solveSync } from "#/game/solver.ts";
import type { Move } from "#/game/types.ts";

export const BASE_URL = Deno.env.get("BASE_URL") ?? "http://localhost:5173";

const E2E_SECRET = Deno.env.get("E2E_SECRET");

export type SeedUserInput =
  & { name: string }
  & Partial<Omit<User, "id" | "name">>;

/**
 * Seeds a user via the e2e users endpoint.
 * Returns the created User (with server-generated id).
 */
export async function seedUser(input: SeedUserInput): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/e2e/users`, {
    method: "POST",
    headers: seedHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Seed user failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Deletes all KV entries for the given test user (including solutions).
 * Idempotent.
 */
export async function clearTestUser(userId: string) {
  const res = await fetch(`${BASE_URL}/api/e2e/users/${userId}`, {
    method: "DELETE",
    headers: seedHeaders(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Teardown failed: ${res.status} ${text}`);
}

/**
 * Adds the user_id cookie to a Playwright browser context so the server
 * can look up the seeded user record.
 */
export async function addUserCookie(context: BrowserContext, userId: string) {
  await context.addCookies([
    {
      name: "user_id",
      value: userId,
      url: BASE_URL,
      httpOnly: true,
    },
    // Suppress the cookie consent banner for test users
    {
      name: "tracking_id",
      value: "declined",
      url: BASE_URL,
    },
  ]);
}

/**
 * Seeds a solution for an existing user.
 * Returns the created Solution (with server-generated id).
 */
export async function seedSolution(
  input: Omit<Solution, "id">,
): Promise<Solution> {
  const res = await fetch(`${BASE_URL}/api/e2e/solutions`, {
    method: "POST",
    headers: seedHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Seed solution failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Loads a puzzle by slug and returns the optimal solution moves.
 * Throws if the puzzle doesn't exist.
 */
// TODO: rename to getPuzzleSolution
export async function solvePuzzle(slug: string): Promise<Move[]> {
  const puzzle = await getPuzzle(slug);
  if (!puzzle) throw new Error(`Puzzle not found: ${slug}`);
  return solveSync(puzzle);
}

function seedHeaders() {
  return {
    "content-type": "application/json",
    "x-e2e-secret": E2E_SECRET ?? "",
  };
}
