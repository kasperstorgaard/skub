import { assertEquals } from "@std/assert";

import {
  generateFlashStart,
  getFlashStartLength,
  isStuck,
  withFlashStart,
} from "#/game/flash.ts";
import { parsePuzzle } from "#/game/parser.ts";
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

Deno.test("getFlashStartLength() gives 3 moves from 10", () => {
  assertEquals(getFlashStartLength(10), 3);
});

Deno.test("getFlashStartLength() gives 2 moves at 9", () => {
  assertEquals(getFlashStartLength(9), 2);
});

Deno.test("getFlashStartLength() gives 2 moves from 8", () => {
  assertEquals(getFlashStartLength(8), 2);
});

Deno.test("getFlashStartLength() gives 1 move at 7", () => {
  assertEquals(getFlashStartLength(7), 1);
});

Deno.test("getFlashStartLength() gives 1 move from 5", () => {
  assertEquals(getFlashStartLength(5), 1);
});

Deno.test("getFlashStartLength() gives nothing below 5", () => {
  assertEquals(getFlashStartLength(4), 0);
});

Deno.test("withFlashStart() starts the board after the Flash start", () => {
  const flashed = withFlashStart(puzzle, solution.slice(0, 1));
  assertEquals(flashed.board.pieces, [{ x: 0, y: 7, type: "puck" }]);
});

Deno.test("withFlashStart() takes the Flash start off the shortest solution", () => {
  const flashed = withFlashStart(puzzle, solution.slice(0, 2));
  assertEquals(flashed.minMoves, 6);
});

Deno.test("generateFlashStart() plays 2 moves into an 8-move puzzle", async () => {
  const alice = parsePuzzle(
    await Deno.readTextFile("./static/puzzles/alice.md"),
  );
  assertEquals(generateFlashStart(alice)?.length, 2);
});

Deno.test("generateFlashStart() gives none below 5 moves", () => {
  assertEquals(generateFlashStart({ ...puzzle, minMoves: 2 }), undefined);
});

Deno.test("isStuck() offers Flash after twice the shortest solution in moves", () => {
  assertEquals(isStuck({ moves: 16, reversals: 0 }, 8), true);
});

Deno.test("isStuck() holds off before that", () => {
  assertEquals(isStuck({ moves: 15, reversals: 2 }, 8), false);
});

Deno.test("isStuck() offers Flash after three times back", () => {
  assertEquals(isStuck({ moves: 4, reversals: 3 }, 8), true);
});
