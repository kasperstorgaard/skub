import { assertEquals } from "@std/assert";

import { decodeEntry, encodeEntry } from "#/lib/kv-json.ts";

const entry = { versionstamp: "00000000000000010000" };

Deno.test("encodeEntry() and decodeEntry() keep a key's strings and numbers", () => {
  const key = ["solution_groups_by_puzzle", "boxy", 7, "A1-A8"];
  const json = JSON.parse(
    JSON.stringify(encodeEntry({ ...entry, key, value: 1 })),
  );

  assertEquals(decodeEntry(json).key, key);
});

Deno.test("encodeEntry() and decodeEntry() keep a date in a value", () => {
  const value = { createdAt: new Date("2026-11-07T12:00:00.000Z") };
  const json = JSON.parse(
    JSON.stringify(encodeEntry({ ...entry, key: ["draft"], value })),
  );

  assertEquals(decodeEntry(json).value, value);
});

Deno.test("encodeEntry() and decodeEntry() keep bytes and big integers", () => {
  const value = { bytes: new Uint8Array([0, 1, 255]), big: 2n ** 70n };
  const json = JSON.parse(
    JSON.stringify(encodeEntry({ ...entry, key: ["mixed"], value })),
  );

  assertEquals(decodeEntry(json).value, value);
});

Deno.test("encodeEntry() and decodeEntry() keep a KV counter", () => {
  const value = new Deno.KvU64(42n);
  const json = JSON.parse(
    JSON.stringify(encodeEntry({ ...entry, key: ["count"], value })),
  );

  assertEquals((decodeEntry(json).value as Deno.KvU64).value, 42n);
});
