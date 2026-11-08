import { assertEquals } from "@std/assert";

import { getPlayerId } from "#/db/backup-keys.ts";

Deno.test("a solution belongs to the player who saved it", () => {
  const entry = { key: ["solutions_by_user", "u1", "s1"], value: {} };
  assertEquals(getPlayerId(entry), "u1");
});

Deno.test("a login belongs to the player it signs in", () => {
  const entry = { key: ["auth", "google|2", "userId"], value: "u2" };
  assertEquals(getPlayerId(entry), "u2");
});

Deno.test("a public solution key doesn't name a player", () => {
  const entry = { key: ["solutions_by_puzzle", "karla", "s1"], value: {} };
  assertEquals(getPlayerId(entry), undefined);
});
