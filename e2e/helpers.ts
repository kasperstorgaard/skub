import type { BrowserContext } from "playwright";

export const BASE_URL = Deno.env.get("BASE_URL") ?? "http://localhost:5173";

const E2E_SECRET = Deno.env.get("E2E_SECRET");

/**
 * Seeds a named user via the app's seed route, so it lands in the same KV
 * instance the app reads from.
 */
export async function seedNamedUser(userId: string, name: string) {
  const res = await fetch(`${BASE_URL}/api/e2e/seed`, {
    method: "POST",
    headers: seedHeaders(),
    body: JSON.stringify({ userId, name }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Seed failed: ${res.status} ${text}`);
}

/**
 * Deletes all KV entries for the given test user via the app's seed route.
 * Idempotent.
 */
export async function clearTestUser(userId: string) {
  const res = await fetch(`${BASE_URL}/api/e2e/seed`, {
    method: "DELETE",
    headers: seedHeaders(),
    body: JSON.stringify({ userId }),
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

function seedHeaders() {
  return {
    "content-type": "application/json",
    "x-e2e-secret": E2E_SECRET ?? "",
  };
}
