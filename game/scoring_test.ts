import { assertEquals, assertNotEquals } from "@std/assert";

import { flipBoard } from "./board.ts";
import {
  boardCanonicalHash,
  boardSelfSymmetries,
  checkGates,
  computeMetrics,
  computeTrails,
  coverage,
  crossTrailOverlap,
  deception,
  deduplicateSolutions,
  firstMovePrecision,
  pieceUsage,
  pointlessClearance,
  reversals,
  sameDirectionRepeat,
  scoreBoard,
  searchProfile,
  setupRatio,
  stopTypes,
  totalDistance,
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

Deno.test("setupRatio() is zero when only the puck moves", () => {
  const board: Board = {
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  assertEquals(setupRatio(board, [[[{ x: 0, y: 0 }, { x: 7, y: 0 }]]]), 0);
});

Deno.test("coverage() counts the puck's swept cells over 64", () => {
  const board: Board = {
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  // Puck sweeps A1..H1 = 8 cells.
  assertEquals(coverage(board, [[[{ x: 0, y: 0 }, { x: 7, y: 0 }]]]), 8 / 64);
});

Deno.test("totalDistance() sums slide length split by role", () => {
  const board: Board = {
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  assertEquals(totalDistance(board, [[[{ x: 0, y: 0 }, { x: 7, y: 0 }]]]), {
    puck: 7,
    blocker: 0,
  });
});

Deno.test("deception() sums how far the puck slides away from the destination", () => {
  const board: Board = {
    destination: { x: 0, y: 0 },
    pieces: [{ x: 3, y: 0, type: "puck" }],
    walls: [],
  };

  // Puck slides from x=3 to x=7, away from dest x=0: 7-3 = 4.
  assertEquals(deception(board, [[[{ x: 3, y: 0 }, { x: 7, y: 0 }]]]), 4);
});

Deno.test("reversals() counts a piece moving in opposite directions", () => {
  const board: Board = {
    destination: { x: 3, y: 3 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  assertEquals(
    reversals(board, [[
      [{ x: 0, y: 0 }, { x: 7, y: 0 }],
      [{ x: 7, y: 0 }, { x: 0, y: 0 }],
    ]]),
    1,
  );
});

Deno.test("crossTrailOverlap() counts cells two pieces both sweep", () => {
  const board: Board = {
    destination: { x: 7, y: 7 },
    pieces: [
      { x: 0, y: 3, type: "puck" },
      { x: 3, y: 0, type: "blocker" },
    ],
    walls: [],
  };

  // Blocker sweeps column 3, puck sweeps row 3 — they cross at (3,3).
  assertEquals(
    crossTrailOverlap(board, [[
      [{ x: 3, y: 0 }, { x: 3, y: 7 }],
      [{ x: 0, y: 3 }, { x: 7, y: 3 }],
    ]]),
    1,
  );
});

Deno.test("searchProfile() is the last-third share of explored states", () => {
  assertEquals(searchProfile([1, 2, 1]), 1 / 4);
});

Deno.test("firstMovePrecision() is the reciprocal of distinct openings", () => {
  assertEquals(firstMovePrecision(4), 1 / 4);
});

Deno.test("stopTypes() classifies a slide into the wall as an edge stop", () => {
  const board: Board = {
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  assertEquals(stopTypes(board, [[[{ x: 0, y: 0 }, { x: 7, y: 0 }]]]), {
    edge: 1,
    wall: 0,
    piece: 0,
    blockerOnPuck: 0,
  });
});

Deno.test("pieceUsage() is zero when no blocker is used", () => {
  const board: Board = {
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  assertEquals(pieceUsage(board, [[[{ x: 0, y: 0 }, { x: 7, y: 0 }]]]), 0);
});

Deno.test("pointlessClearance() counts a blocker that never interacts again", () => {
  const board: Board = {
    destination: { x: 7, y: 0 },
    pieces: [
      { x: 0, y: 0, type: "puck" },
      { x: 3, y: 3, type: "blocker" },
    ],
    walls: [],
  };

  // Blocker slides away and is never touched again; puck finishes on its own.
  assertEquals(
    pointlessClearance(board, [[
      [{ x: 3, y: 3 }, { x: 3, y: 7 }],
      [{ x: 0, y: 0 }, { x: 7, y: 0 }],
    ]]),
    1,
  );
});

Deno.test("sameDirectionRepeat() counts cells re-crossed in the same direction", () => {
  const board: Board = {
    destination: { x: 7, y: 7 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  // Right, back left, right again — the 8 row-0 cells are crossed rightward twice.
  assertEquals(
    sameDirectionRepeat(board, [[
      [{ x: 0, y: 0 }, { x: 7, y: 0 }],
      [{ x: 7, y: 0 }, { x: 0, y: 0 }],
      [{ x: 0, y: 0 }, { x: 7, y: 0 }],
    ]]),
    8,
  );
});

Deno.test("computeMetrics() reports the full metric set for the ingrid puzzle", () => {
  const metrics = computeMetrics(ingridBoard, solveExhaustiveSync(ingridBoard));

  assertEquals(metrics, {
    setupRatio: 0.42857142857142855,
    pieceUsage: 5.169925001442312,
    deception: 6,
    reversals: 1,
    crossTrailOverlap: 9,
    totalDistance: { puck: 16, blocker: 10 },
    uniqueSolutions: 4,
    firstMovePrecision: 0.16666666666666666,
    searchProfile: 0.8934068908865179,
    coverage: 0.265625,
    stopTypes: { edge: 1, wall: 4, piece: 2, blockerOnPuck: 0 },
    pointlessClearance: 0,
    sameDirectionRepeat: 0,
  });
});

const noCorpus = { corpus: new Set<string>(), batchHashes: new Set<string>() };

Deno.test("checkGates() passes the ingrid puzzle as a medium board", () => {
  assertEquals(
    checkGates(ingridBoard, { difficulty: "medium", ...noCorpus }),
    { passed: true },
  );
});

Deno.test("checkGates() fails G2 when minMoves is outside the band", () => {
  assertEquals(
    checkGates(ingridBoard, { difficulty: "hard", ...noCorpus }),
    { passed: false, failedGate: "G2" },
  );
});

Deno.test("checkGates() fails G3 when the board is already in the corpus", () => {
  const corpus = new Set([boardCanonicalHash(ingridBoard)]);

  assertEquals(
    checkGates(ingridBoard, {
      difficulty: "medium",
      corpus,
      batchHashes: new Set(),
    }),
    { passed: false, failedGate: "G3" },
  );
});

Deno.test("scoreBoard() produces a composite within [-1, 1]", () => {
  const { score } = scoreBoard(ingridBoard, solveExhaustiveSync(ingridBoard));

  assertEquals(score >= -1 && score <= 1, true);
});
