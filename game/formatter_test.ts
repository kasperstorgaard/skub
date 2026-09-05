import { assertEquals } from "@std/assert";

import { formatPuzzle } from "./formatter.ts";
import { parsePuzzle } from "./parser.ts";
import type { Puzzle } from "#/game/types.ts";

Deno.test("formatPuzzle - formats simple puzzle", () => {
  const puzzle: Puzzle = {
    number: 5,
    name: "Simple Puzzle",
    slug: "simple-puzzle",
    createdAt: new Date("2024-06-20T00:00:00.000Z"),
    difficulty: "medium",
    minMoves: 7,
    board: {
      holes: [],
      portals: [],
      destination: { x: 3, y: 7 },
      pieces: [
        { x: 1, y: 1, type: "puck" },
        { x: 4, y: 4, type: "blocker" },
      ],
      walls: [],
    },
  };

  const result = formatPuzzle(puzzle);

  // Parse it back to verify round-trip
  const parsed = parsePuzzle(result);

  assertEquals(parsed, puzzle);
});

Deno.test("formatPuzzle - formats puzzle with walls", () => {
  const puzzle: Puzzle = {
    number: 5,
    name: "Walls Puzzle",
    slug: "walls-puzzle",
    createdAt: new Date("2024-06-20T00:00:00.000Z"),
    difficulty: "medium",
    minMoves: 6,
    board: {
      holes: [],
      portals: [],
      destination: { x: 7, y: 7 },
      pieces: [{ x: 0, y: 0, type: "puck" }],
      walls: [
        { x: 2, y: 2, orientation: "horizontal" },
        { x: 5, y: 5, orientation: "vertical" },
      ],
    },
  };

  const result = formatPuzzle(puzzle);

  // Verify it contains wall markers
  const parsed = parsePuzzle(result);
  assertEquals(parsed.board.walls.length, 2);
});

Deno.test("formatPuzzle - formats puzzle with piece on destination", () => {
  const puzzle: Puzzle = {
    number: 5,
    name: "Piece on Destination",
    slug: "piece-on-destination",
    createdAt: new Date("2024-06-20T00:00:00.000Z"),
    difficulty: "medium",
    minMoves: 6,
    board: {
      holes: [],
      portals: [],
      destination: { x: 4, y: 4 },
      pieces: [
        { x: 4, y: 4, type: "puck" }, // Puck on destination
        { x: 2, y: 2, type: "blocker" },
      ],
      walls: [],
    },
  };

  const result = formatPuzzle(puzzle);

  // Parse it back to verify round-trip
  const parsed = parsePuzzle(result);
  assertEquals(parsed.board.destination, puzzle.board.destination);
  assertEquals(parsed.board.pieces.length, 2);

  // Verify the destination matches the puck position
  const puckOnDest = parsed.board.pieces.find((p) =>
    p.x === 4 && p.y === 4 && p.type === "puck"
  );
  assertEquals(puckOnDest !== undefined, true);
});

Deno.test("formatPuzzle - formats puzzle with piece on destination and wall", () => {
  const puzzle: Puzzle = {
    number: 5,
    name: "Complex Piece",
    slug: "complex-piece",
    createdAt: new Date("2024-06-20T00:00:00.000Z"),
    difficulty: "medium",
    minMoves: 6,
    board: {
      holes: [],
      portals: [],
      destination: { x: 3, y: 2 },
      pieces: [
        { x: 0, y: 0, type: "puck" }, // Need a puck for validation
        { x: 3, y: 2, type: "blocker" }, // Blocker on destination with wall below
      ],
      walls: [
        { x: 3, y: 3, orientation: "horizontal" }, // Wall below the piece (stored at y+1)
      ],
    },
  };

  const result = formatPuzzle(puzzle);

  // Parse it back to verify round-trip
  const parsed = parsePuzzle(result);
  assertEquals(parsed.board.destination, puzzle.board.destination);
  assertEquals(parsed.board.pieces.length, 2);
  assertEquals(parsed.board.walls.length, 1);

  // Verify the destination matches the blocker position
  const blockerOnDest = parsed.board.pieces.find((p) =>
    p.x === 3 && p.y === 2 && p.type === "blocker"
  );
  assertEquals(blockerOnDest !== undefined, true);
});
