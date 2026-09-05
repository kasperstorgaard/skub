import {
  assertEquals,
  assertNotEquals,
  assertObjectMatch,
  assertThrows,
} from "@std/assert";
import { assertExists } from "@std/assert/exists";

import { isValidSolution, resolveMoves } from "./board.ts";
import {
  enumerateSolutions,
  optimalFirstMoves,
  solve,
  solveExhaustiveSync,
  SolverDepthExceededError,
  solveSync,
} from "./solver.ts";
import type { Board, Puzzle } from "#/game/types.ts";

// Real puzzle fixture (static/puzzles/ingrid.md, 7 moves) for exhaustive-solver
// tests — a realistic board rather than a hand-crafted one.
const ingridBoard: Board = {
  holes: [],
  portals: [],
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

Deno.test("solveSync() finds 1-move solution (puck slides to destination)", () => {
  // Puck at A1 (0,0) slides right to H1 (7,0) where destination is
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  const result = solveSync(board);

  assertEquals(result, [[{ x: 0, y: 0 }, { x: 7, y: 0 }]]);
});

Deno.test("solveSync() finds 2-move solution", () => {
  // Puck at A1, needs to go to H8
  // Move 1: A1 -> A8 (down)
  // Move 2: A8 -> H8 (right)
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 7, y: 7 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  const result = solveSync(board);
  assertEquals(result?.length, 2);
});

Deno.test("solveSync() throws for unsolvable puzzle (puck trapped)", () => {
  // Puck at A1 trapped by walls, cannot reach H8
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 7, y: 7 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [
      { x: 1, y: 0, orientation: "vertical" },
      { x: 0, y: 1, orientation: "horizontal" },
    ],
  };

  assertThrows(() => solveSync(board));
});

Deno.test("solveSync() throws for unsolvable puzzle (puck can't stop)", () => {
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 5, y: 5 },
    pieces: [
      { x: 1, y: 1, type: "puck" },
    ],
    walls: [],
  };

  assertThrows(() => solveSync(board));
});

Deno.test("solveSync() respects maxDepth option", () => {
  // Puzzle that requires at least 2 moves
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 7, y: 7 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  // With maxDepth 1, it should not find the 2-move solution
  assertThrows(
    () => solveSync(board, { maxDepth: 1 }),
    SolverDepthExceededError,
  );
});

Deno.test("solveSync() accepts Puzzle type (not just Board)", () => {
  const puzzle: Puzzle = {
    number: 5,
    slug: "test",
    name: "Test",
    createdAt: new Date(),
    difficulty: "medium",
    minMoves: 7,
    board: {
      holes: [],
      portals: [],
      destination: { x: 7, y: 0 },
      pieces: [{ x: 0, y: 0, type: "puck" as const }],
      walls: [],
    },
  };

  const result = solveSync(puzzle);

  assertEquals(result?.length, 1);
});

Deno.test("solve() yields progress then solution", () => {
  // Puck at (0,0), dest at (7,7) — not aligned, initial threshold = 2
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 7, y: 7 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  let lastProgress: { depth: number };
  let solution: unknown;

  for (const event of solve(board, {})) {
    if (event.type === "progress") lastProgress = event;
    if (event.type === "solution") solution = event.moves;
  }

  assertObjectMatch(lastProgress!, { depth: 1 });
  assertExists(solution);
});

Deno.test("solveSync() solves complex puzzle", () => {
  const board: Board = {
    holes: [],
    portals: [],
    "destination": { "x": 4, "y": 5 },
    "pieces": [
      { "x": 1, "y": 1, "type": "blocker" },
      { "x": 6, "y": 1, "type": "puck" },
      { "x": 1, "y": 6, "type": "blocker" },
      { "x": 6, "y": 6, "type": "blocker" },
    ],
    "walls": [
      { "x": 2, "y": 2, "orientation": "horizontal" },
      { "x": 3, "y": 2, "orientation": "horizontal" },
      { "x": 4, "y": 2, "orientation": "horizontal" },
      { "x": 5, "y": 2, "orientation": "horizontal" },
      { "x": 2, "y": 2, "orientation": "vertical" },
      { "x": 6, "y": 2, "orientation": "vertical" },
      { "x": 6, "y": 3, "orientation": "vertical" },
      { "x": 6, "y": 4, "orientation": "vertical" },
      { "x": 2, "y": 5, "orientation": "vertical" },
      { "x": 2, "y": 6, "orientation": "horizontal" },
      { "x": 3, "y": 6, "orientation": "horizontal" },
      { "x": 4, "y": 6, "orientation": "horizontal" },
      { "x": 6, "y": 5, "orientation": "vertical" },
      { "x": 5, "y": 6, "orientation": "horizontal" },
    ],
  };

  const result = solveSync(board);

  // Solution is optimal and valid (IDA* may find a different path of equal length)
  assertEquals(result.length, 10);
  assertEquals(isValidSolution(resolveMoves(board, result)), true);
});

Deno.test("solveSync() solves complex puzzle with many pieces", () => {
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 3, y: 6 },
    pieces: [
      { x: 2, y: 1, type: "blocker" },
      { x: 5, y: 2, type: "puck" },
      { x: 7, y: 3, type: "blocker" },
      { x: 0, y: 4, type: "blocker" },
      { x: 3, y: 6, type: "blocker" },
    ],
    walls: [
      { x: 1, y: 0, orientation: "vertical" },
      { x: 6, y: 0, orientation: "vertical" },
      { x: 0, y: 2, orientation: "horizontal" },
      { x: 7, y: 2, orientation: "horizontal" },
      { x: 2, y: 3, orientation: "horizontal" },
      { x: 3, y: 3, orientation: "horizontal" },
      { x: 4, y: 3, orientation: "horizontal" },
      { x: 5, y: 3, orientation: "horizontal" },
      { x: 2, y: 3, orientation: "vertical" },
      { x: 6, y: 3, orientation: "vertical" },
      { x: 2, y: 4, orientation: "vertical" },
      { x: 2, y: 5, orientation: "horizontal" },
      { x: 3, y: 5, orientation: "horizontal" },
      { x: 4, y: 5, orientation: "horizontal" },
      { x: 6, y: 4, orientation: "vertical" },
      { x: 5, y: 5, orientation: "horizontal" },
      { x: 0, y: 6, orientation: "horizontal" },
      { x: 7, y: 6, orientation: "horizontal" },
      { x: 2, y: 7, orientation: "vertical" },
      { x: 7, y: 7, orientation: "vertical" },
    ],
  };

  const result = solveSync(board);

  // Solution is optimal and valid (IDA* may find a different path of equal length)
  assertEquals(result.length, 9);
  assertEquals(isValidSolution(resolveMoves(board, result)), true);
});

Deno.test("solveSync() finds 8-move solution for sara puzzle", () => {
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 4, y: 5 },
    pieces: [
      { x: 2, y: 0, type: "blocker" },
      { x: 0, y: 1, type: "puck" },
      { x: 5, y: 1, type: "blocker" },
      { x: 7, y: 3, type: "blocker" },
      { x: 1, y: 4, type: "blocker" },
      { x: 5, y: 6, type: "blocker" },
      { x: 3, y: 7, type: "blocker" },
    ],
    walls: [
      { x: 4, y: 0, orientation: "vertical" },
      { x: 1, y: 2, orientation: "horizontal" },
      { x: 4, y: 1, orientation: "vertical" },
      { x: 6, y: 2, orientation: "horizontal" },
      { x: 1, y: 2, orientation: "vertical" },
      { x: 7, y: 2, orientation: "vertical" },
      { x: 4, y: 5, orientation: "vertical" },
      { x: 2, y: 6, orientation: "vertical" },
      { x: 1, y: 7, orientation: "horizontal" },
      { x: 6, y: 6, orientation: "vertical" },
      { x: 6, y: 7, orientation: "horizontal" },
      { x: 1, y: 7, orientation: "vertical" },
      { x: 7, y: 7, orientation: "vertical" },
    ],
  };
  const result = solveSync(board);

  assertEquals(result.length, 8);
  assertEquals(isValidSolution(resolveMoves(board, result)), true);
});

Deno.test("solveExhaustiveSync() returns the single optimal solution for a unique board", () => {
  // Puck at A1 (0,0) has exactly one 1-move path to the destination at H1 (7,0).
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  const result = solveExhaustiveSync(board);

  assertEquals(
    { minMoves: result.minMoves, solutions: enumerateSolutions(result.dag) },
    { minMoves: 1, solutions: [[[{ x: 0, y: 0 }, { x: 7, y: 0 }]]] },
  );
});

Deno.test("solveExhaustiveSync() records new states discovered per depth", () => {
  // Empty board, A1 -> H8: depth 0 is the start, depth 1 adds the right/down
  // slides, depth 2 adds the goal corner.
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 7, y: 7 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  const result = solveExhaustiveSync(board);

  assertEquals(result.statesPerDepth, [1, 2, 1]);
});

Deno.test("solveExhaustiveSync() enumerates both optimal paths on an open board", () => {
  // Empty board: A1 -> H8 is 2 moves via two symmetric L-shaped paths.
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 7, y: 7 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  const result = solveExhaustiveSync(board);

  assertEquals(
    { minMoves: result.minMoves, count: enumerateSolutions(result.dag).length },
    { minMoves: 2, count: 2 },
  );
});

Deno.test("solveExhaustiveSync() returns distinct solutions", () => {
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 7, y: 7 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  const [first, second] = enumerateSolutions(solveExhaustiveSync(board).dag);

  assertNotEquals(first, second);
});

Deno.test("solveExhaustiveSync() without overshoot searches only to the optimal depth", () => {
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }, { x: 4, y: 4, type: "blocker" }],
    walls: [],
  };

  const result = solveExhaustiveSync(board);

  assertEquals(
    {
      minMoves: result.minMoves,
      searchedDepth: result.searchedDepth,
      optimalGoals: result.dag.goals.length,
      nearGoals: result.nearDag.goals.length,
    },
    { minMoves: 1, searchedDepth: 1, optimalGoals: 1, nearGoals: 0 },
  );
});

Deno.test("solveExhaustiveSync() overshoot records suboptimal goal arrivals", () => {
  // Optimal is the 1-move slide A1 -> H1. With overshoot, depth 2 collects the
  // near-miss goal states where the blocker also moved (4 edges to slide to).
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }, { x: 4, y: 4, type: "blocker" }],
    walls: [],
  };

  const result = solveExhaustiveSync(board, { overshoot: 2 });

  assertEquals(
    {
      minMoves: result.minMoves,
      searchedDepth: result.searchedDepth,
      optimalGoals: result.dag.goals.length,
      hasNearMisses: result.nearDag.goals.length > 0,
    },
    { minMoves: 1, searchedDepth: 3, optimalGoals: 1, hasNearMisses: true },
  );
});

Deno.test("solveExhaustiveSync() overshoot keeps the DAG optimal-only", () => {
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }, { x: 4, y: 4, type: "blocker" }],
    walls: [],
  };

  const solutions = enumerateSolutions(
    solveExhaustiveSync(board, { overshoot: 2 }).dag,
  );

  assertEquals(
    solutions.map((moves) => moves.length),
    [1],
  );
});

Deno.test("solveExhaustiveSync() matches solveSync minMoves on the ingrid puzzle", () => {
  assertEquals(
    solveExhaustiveSync(ingridBoard).minMoves,
    solveSync(ingridBoard).length,
  );
});

Deno.test("solveExhaustiveSync() enumerates every optimal solution on the ingrid puzzle", () => {
  // Fixed expected output for a real 7-move puzzle: 26 optimal move sequences
  // (pre-canonicalization — independent-move orderings and interchangeable
  // blockers inflate the count), 6 distinct optimal openings, and the per-depth
  // frontier sizes. Pins the exhaustive search to known-good data instead of
  // re-validating each solution at runtime.
  const result = solveExhaustiveSync(ingridBoard);

  assertEquals(
    {
      minMoves: result.minMoves,
      solutions: enumerateSolutions(result.dag).length,
      firstMoves: optimalFirstMoves(result.dag).length,
      statesPerDepth: result.statesPerDepth,
    },
    {
      minMoves: 7,
      solutions: 26,
      firstMoves: 6,
      statesPerDepth: [1, 14, 106, 565, 2377, 8356, 25569, 70139],
    },
  );
});

Deno.test("solveExhaustiveSync() throws for an unsolvable puzzle", () => {
  // Puck can never stop on the destination row/column.
  const board: Board = {
    holes: [],
    portals: [],
    destination: { x: 5, y: 5 },
    pieces: [{ x: 1, y: 1, type: "puck" }],
    walls: [],
  };

  assertThrows(() => solveExhaustiveSync(board));
});
