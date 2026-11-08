import { assertEquals } from "@std/assert";

import {
  backupPrefixes,
  getPlayerId,
  perPlayerPrefixes,
} from "#/db/backup-keys.ts";

Deno.test("every prefix db/ writes is backed up", async () => {
  const dir = new URL("./", import.meta.url);
  const written = new Set<string>();
  for await (const file of Deno.readDir(dir)) {
    // kv.ts types its proxy with Deno.Kv["get"] and the like, not keys.
    if (file.name.endsWith("_test.ts") || file.name === "kv.ts") continue;
    const source = await Deno.readTextFile(new URL(file.name, dir));
    for (const [, prefix] of source.matchAll(/\[\s*"([a-z_]+)"/g)) {
      written.add(prefix);
    }
  }
  const listed = new Set([...backupPrefixes, ...perPlayerPrefixes]);
  assertEquals([...written].filter((prefix) => !listed.has(prefix)), []);
});

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
