import { assertEquals } from "@std/assert";

import {
  getHeadStart,
  getHeadStartLength,
  withHeadStart,
} from "#/game/flash.ts";
import type { Move, Puzzle } from "#/game/types.ts";

const solution: Move[] = [
  [{ x: 0, y: 0 }, { x: 0, y: 7 }],
  [{ x: 0, y: 7 }, { x: 7, y: 7 }],
  [{ x: 7, y: 7 }, { x: 7, y: 2 }],
  [{ x: 7, y: 2 }, { x: 3, y: 2 }],
];

// A puck in the top-left corner of an open board, two slides from the corner
// opposite.
const puzzle: Puzzle = {
  slug: "corner",
  name: "Corner",
  createdAt: new Date("2026-11-02"),
  difficulty: "easy",
  minMoves: 8,
  board: {
    destination: { x: 7, y: 7 },
    walls: [],
    pieces: [{ x: 0, y: 0, type: "puck" }],
    holes: [],
    portals: [],
  },
};

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

Deno.test("withHeadStart() starts the board after the head start", () => {
  const flashed = withHeadStart(puzzle, solution.slice(0, 1));
  assertEquals(flashed.board.pieces, [{ x: 0, y: 7, type: "puck" }]);
});

Deno.test("withHeadStart() takes the head start off the shortest solution", () => {
  const flashed = withHeadStart(puzzle, solution.slice(0, 2));
  assertEquals(flashed.minMoves, 6);
});
