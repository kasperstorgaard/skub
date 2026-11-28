import { assertEquals } from "@std/assert";

import { getPathGroups } from "#/game/paths.ts";
import type { Move } from "#/game/types.ts";

// An open board, puck top left: down then right, or right then down, or the
// long way round by the top right corner.
const downRight: Move[] = [
  [{ x: 0, y: 0 }, { x: 0, y: 7 }],
  [{ x: 0, y: 7 }, { x: 7, y: 7 }],
];
const rightDown: Move[] = [
  [{ x: 0, y: 0 }, { x: 7, y: 0 }],
  [{ x: 7, y: 0 }, { x: 7, y: 7 }],
];
const theLongWay: Move[] = [
  [{ x: 0, y: 0 }, { x: 7, y: 0 }],
  [{ x: 7, y: 0 }, { x: 7, y: 3 }],
  [{ x: 7, y: 3 }, { x: 7, y: 7 }],
];

Deno.test("getPathGroups() puts solutions on the same path together, in solve order", () => {
  const groups = getPathGroups([
    { name: "ane", moves: downRight },
    { name: "bo", moves: downRight },
  ]);

  assertEquals(groups[0].solutions.map((solution) => solution.name), [
    "ane",
    "bo",
  ]);
});

Deno.test("getPathGroups() lists the shortest path first", () => {
  const groups = getPathGroups([
    { name: "ane", moves: theLongWay },
    { name: "bo", moves: downRight },
  ]);

  assertEquals(groups.map((group) => group.moves), [2, 3]);
});

Deno.test("getPathGroups() keeps paths of a length in the order they were found", () => {
  const groups = getPathGroups([
    { name: "ane", moves: rightDown },
    { name: "bo", moves: downRight },
  ]);

  assertEquals(
    groups.map((group) => group.solutions[0].name),
    ["ane", "bo"],
  );
});

Deno.test("getPathGroups() counts a path from after the skipped start", () => {
  // Both share the first move as their start, then go the same way.
  const groups = getPathGroups([{ name: "ane", moves: rightDown }], {
    skip: 1,
  });

  assertEquals(groups[0].moves, 1);
});

Deno.test("getPathGroups() tells paths apart by what comes after the start", () => {
  const groups = getPathGroups([
    { name: "ane", moves: rightDown },
    { name: "bo", moves: theLongWay },
  ], { skip: 1 });

  assertEquals(groups.length, 2);
});
