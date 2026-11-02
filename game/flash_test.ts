import { assertEquals } from "@std/assert";

import {
  getHeadStart,
  getHeadStartLength,
  isOnHeadStart,
} from "#/game/flash.ts";
import type { Move } from "#/game/types.ts";

const solution: Move[] = [
  [{ x: 0, y: 0 }, { x: 0, y: 7 }],
  [{ x: 0, y: 7 }, { x: 7, y: 7 }],
  [{ x: 7, y: 7 }, { x: 7, y: 2 }],
  [{ x: 7, y: 2 }, { x: 3, y: 2 }],
];

Deno.test("getHeadStartLength() gives 3 moves from 10", () => {
  assertEquals(getHeadStartLength(10), 3);
});

Deno.test("getHeadStartLength() gives 2 moves at 9", () => {
  assertEquals(getHeadStartLength(9), 2);
});

Deno.test("getHeadStartLength() gives 2 moves from 8", () => {
  assertEquals(getHeadStartLength(8), 2);
});

Deno.test("getHeadStartLength() gives 1 move at 7", () => {
  assertEquals(getHeadStartLength(7), 1);
});

Deno.test("getHeadStartLength() gives 1 move from 5", () => {
  assertEquals(getHeadStartLength(5), 1);
});

Deno.test("getHeadStartLength() gives nothing below 5", () => {
  assertEquals(getHeadStartLength(4), 0);
});

Deno.test("getHeadStart() takes the opening moves of the solution", () => {
  assertEquals(getHeadStart(solution, 8), solution.slice(0, 2));
});

Deno.test("getHeadStart() is empty for a short puzzle", () => {
  assertEquals(getHeadStart(solution, 4), []);
});

const headStart = solution.slice(0, 2);

Deno.test("isOnHeadStart() holds on the head start itself", () => {
  assertEquals(isOnHeadStart({ moves: headStart, cursor: 2 }, headStart), true);
});

Deno.test("isOnHeadStart() holds with moves played after it", () => {
  assertEquals(isOnHeadStart({ moves: solution, cursor: 4 }, headStart), true);
});

Deno.test("isOnHeadStart() fails once undo goes into it", () => {
  assertEquals(isOnHeadStart({ moves: solution, cursor: 1 }, headStart), false);
});

Deno.test("isOnHeadStart() fails on a clean board", () => {
  assertEquals(isOnHeadStart({ moves: [] }, headStart), false);
});

Deno.test("isOnHeadStart() fails when the opening differs", () => {
  const moves: Move[] = [solution[1], solution[0], ...solution.slice(2)];
  assertEquals(isOnHeadStart({ moves, cursor: 4 }, headStart), false);
});
