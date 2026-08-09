import { assert } from "@std/assert/assert";
import { assertEquals } from "@std/assert/equals";

import { getDanishNames, pickUnusedName } from "./names.ts";

Deno.test("pickUnusedName avoids used names (case-insensitive)", () => {
  const names = getDanishNames();
  // Mark every name but one as used, in mixed case, and expect the survivor.
  const survivor = names[0];
  const used = new Set(names.slice(1).map((n) => n.toUpperCase()));

  assertEquals(pickUnusedName(used), survivor);
});

Deno.test("pickUnusedName suffixes when the pool is exhausted", () => {
  const names = getDanishNames();
  const used = new Set(names);

  const picked = pickUnusedName(used);
  const [base, ordinal] = [
    picked.slice(0, picked.lastIndexOf("-")),
    picked.slice(picked.lastIndexOf("-") + 1),
  ];
  assert(names.includes(base), `suffix base "${base}" should be a pool name`);
  assertEquals(ordinal, "2");
});

Deno.test("pickUnusedName skips taken ordinals", () => {
  const names = getDanishNames();
  // Every base name and every `-2` variant taken → expect a `-3`.
  const used = new Set([...names, ...names.map((n) => `${n}-2`)]);

  const picked = pickUnusedName(used);
  assert(picked.endsWith("-3"), `expected a -3 suffix, got "${picked}"`);
});

Deno.test("the Danish name pool is non-empty and unique", () => {
  const names = getDanishNames();
  assert(names.length > 0);
  assertEquals(new Set(names).size, names.length, "names should be unique");
});
