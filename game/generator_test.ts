import { assertEquals } from "@std/assert/equals";
import { assertExists } from "@std/assert/exists";

import { flipBoard } from "./board.ts";
import { generate } from "./generator.ts";
import type { Wall } from "./types.ts";

const wallKey = (w: Wall) => `${w.x},${w.y},${w.orientation}`;
const wallSet = (walls: Wall[]) => new Set(walls.map(wallKey));

Deno.test("generate() produces a valid board", () => {
  const result = generate({
    wallsRange: [5, 10],
    blockersRange: [4, 10],
    wallSpread: "balanced",
  });

  assertExists(result.board);
});

Deno.test("generate() with symmetry 1 yields flip-invariant walls", () => {
  // A fully symmetric layout's wall set is unchanged under both centre-axis
  // flips (the puck/destination are placed free, so only walls are checked).
  const { board } = generate({
    wallsRange: [6, 10],
    blockersRange: [2, 3],
    wallSpread: "spread",
    symmetry: 1,
  });

  const original = wallSet(board.walls);
  for (const axis of ["horizontal", "vertical"] as const) {
    const flipped = wallSet(flipBoard(board, axis).walls);
    assertEquals(
      flipped,
      original,
      `walls should be invariant under ${axis} flip`,
    );
  }
});

Deno.test("generate() with symmetry 0 leaves the layout free-form", () => {
  // Smoke test that the default path is unaffected and still valid.
  const { board } = generate({
    wallsRange: [5, 8],
    blockersRange: [3, 4],
    wallSpread: "balanced",
    symmetry: 0,
  });

  assertExists(board);
});
