import { assertEquals, assertNotEquals } from "@std/assert";

import { flipBoard } from "./board.ts";
import {
  boardCanonicalHash,
  boardSelfSymmetries,
  computeTrails,
  deduplicateSolutions,
} from "./scoring.ts";
import { enumerateSolutions, solveExhaustiveSync } from "./solver.ts";
import type { Board } from "#/game/types.ts";

// Real puzzle fixture (static/puzzles/ingrid.md, 7 moves; 26 raw optimal sequences).
const ingridBoard: Board = {
  destination: { x: 5, y: 2 },
  pieces: [
    { x: 3, y: 0, type: "blocker" },
    { x: 7, y: 2, type: "blocker" },
    { x: 0, y: 4, type: "blocker" },
    { x: 5, y: 6, type: "puck" },
    { x: 6, y: 6, type: "blocker" },
    { x: 3, y: 7, type: "blocker" },
  ],
  walls: [
    { x: 1, y: 1, orientation: "horizontal" },
    { x: 3, y: 1, orientation: "horizontal" },
    { x: 5, y: 2, orientation: "horizontal" },
    { x: 2, y: 3, orientation: "horizontal" },
    { x: 5, y: 2, orientation: "vertical" },
    { x: 7, y: 3, orientation: "horizontal" },
    { x: 0, y: 4, orientation: "horizontal" },
    { x: 2, y: 3, orientation: "vertical" },
    { x: 3, y: 5, orientation: "horizontal" },
    { x: 7, y: 4, orientation: "vertical" },
    { x: 3, y: 5, orientation: "vertical" },
    { x: 5, y: 6, orientation: "horizontal" },
    { x: 2, y: 6, orientation: "vertical" },
    { x: 6, y: 6, orientation: "vertical" },
  ],
};

const asymmetricBoard: Board = {
  destination: { x: 5, y: 2 },
  pieces: [
    { x: 1, y: 1, type: "blocker" },
    { x: 6, y: 1, type: "puck" },
    { x: 1, y: 6, type: "blocker" },
  ],
  walls: [
    { x: 2, y: 2, orientation: "horizontal" },
    { x: 6, y: 4, orientation: "vertical" },
  ],
};

Deno.test("boardCanonicalHash() is stable for the same board", () => {
  assertEquals(
    boardCanonicalHash(asymmetricBoard),
    boardCanonicalHash(asymmetricBoard),
  );
});

Deno.test("boardCanonicalHash() matches a board and its mirror image", () => {
  assertEquals(
    boardCanonicalHash(asymmetricBoard),
    boardCanonicalHash(flipBoard(asymmetricBoard, "horizontal")),
  );
});

Deno.test("boardCanonicalHash() differs for structurally different boards", () => {
  const other: Board = { ...asymmetricBoard, destination: { x: 0, y: 0 } };

  assertNotEquals(
    boardCanonicalHash(asymmetricBoard),
    boardCanonicalHash(other),
  );
});

Deno.test("boardCanonicalHash() ignores blocker ordering", () => {
  const reordered: Board = {
    ...asymmetricBoard,
    pieces: [
      { x: 1, y: 6, type: "blocker" },
      { x: 6, y: 1, type: "puck" },
      { x: 1, y: 1, type: "blocker" },
    ],
  };

  assertEquals(
    boardCanonicalHash(asymmetricBoard),
    boardCanonicalHash(reordered),
  );
});

Deno.test("boardSelfSymmetries() is empty for an asymmetric board", () => {
  assertEquals(boardSelfSymmetries(asymmetricBoard), []);
});

Deno.test("computeTrails() tags every swept cell of a slide", () => {
  const board: Board = {
    destination: { x: 3, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  const trails = computeTrails(board, [[[{ x: 0, y: 0 }, { x: 3, y: 0 }]]]);

  assertEquals(trails, [[
    { pos: 0, pieceRole: "puck", direction: "right", moveIndex: 0 },
    { pos: 1, pieceRole: "puck", direction: "right", moveIndex: 0 },
    { pos: 2, pieceRole: "puck", direction: "right", moveIndex: 0 },
    { pos: 3, pieceRole: "puck", direction: "right", moveIndex: 0 },
  ]]);
});

Deno.test("deduplicateSolutions() keeps genuinely distinct routes", () => {
  // Open board A1 -> H8: two L-shaped routes, each with dependent moves that
  // can't be reordered — so they stay two classes.
  const board: Board = {
    destination: { x: 7, y: 7 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  const solutions = enumerateSolutions(solveExhaustiveSync(board).dag);

  assertEquals(deduplicateSolutions(solutions).length, 2);
});

Deno.test("deduplicateSolutions() groups the ingrid solutions as the product does", () => {
  // Reusing the KV/highscore canonical key (sorted move multiset) collapses the
  // 26 raw sequences to the same 4 distinct solutions the product counts.
  const solutions = enumerateSolutions(solveExhaustiveSync(ingridBoard).dag);

  assertEquals(
    { raw: solutions.length, classes: deduplicateSolutions(solutions).length },
    { raw: 26, classes: 4 },
  );
});
