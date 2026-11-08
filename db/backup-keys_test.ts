import { assertEquals } from "@std/assert";

import { getPlayerIds } from "#/db/backup-keys.ts";

Deno.test("a player with solves and a login counts once", () => {
  const entries = [
    { key: ["solutions_by_user", "u1", "s1"], value: {} },
    { key: ["solutions_by_user", "u1", "s2"], value: {} },
    { key: ["auth", "google|1", "userId"], value: "u1" },
  ];
  assertEquals(getPlayerIds(entries), ["u1"]);
});

Deno.test("a player with only a login counts", () => {
  const entries = [{ key: ["auth", "google|2", "userId"], value: "u2" }];
  assertEquals(getPlayerIds(entries), ["u2"]);
});

Deno.test("public solution keys don't make a player", () => {
  const entries = [{ key: ["solutions_by_puzzle", "karla", "s1"], value: {} }];
  assertEquals(getPlayerIds(entries), []);
});
