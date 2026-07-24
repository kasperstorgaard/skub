import { assertEquals, assertNotEquals } from "@std/assert";

import { flipBoard } from "./board.ts";
import {
  boardCanonicalHash,
  boardSelfSymmetries,
  checkGates,
  clumping,
  computeMetrics,
  computeTrails,
  coverage,
  crossTrailOverlap,
  deadSpace,
  deception,
  deduplicateSolutions,
  firstMovePrecision,
  genuineNearMisses,
  pieceUsage,
  pointlessClearance,
  reversals,
  sameDirectionRepeat,
  scoreBoard,
  searchProfile,
  setupRatio,
  stopWeighted,
  totalDistance,
  wallUtilization,
} from "./scoring.ts";
import {
  enumerateSolutions,
  type SolutionDag,
  solveExhaustiveSync,
  type SolverResult,
} from "./solver.ts";
import type { Board, Move } from "#/game/types.ts";

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

/** Dummy DAG for synthetic SolverResults (isolation metrics never read it). */
const emptyDag = { root: 0, goals: [], predecessors: new Map() };

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

  assertEquals(setupRatio(board, [[{ x: 0, y: 0 }, { x: 7, y: 0 }]]), 0);
});

Deno.test("coverage() counts the puck's swept cells over 64", () => {
  const board: Board = {
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  // Puck sweeps A1..H1 = 8 cells.
  assertEquals(coverage(board, [[{ x: 0, y: 0 }, { x: 7, y: 0 }]]), 8 / 64);
});

Deno.test("totalDistance() sums a solution's total slide length", () => {
  const board: Board = {
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  assertEquals(totalDistance(board, [[{ x: 0, y: 0 }, { x: 7, y: 0 }]]), 7);
});

Deno.test("deception() sums how far the puck slides away from the destination", () => {
  const board: Board = {
    destination: { x: 0, y: 0 },
    pieces: [{ x: 3, y: 0, type: "puck" }],
    walls: [],
  };

  // Puck slides from x=3 to x=7, away from dest x=0: 7-3 = 4.
  assertEquals(deception(board, [[{ x: 3, y: 0 }, { x: 7, y: 0 }]]), 4);
});

Deno.test("reversals() counts a piece moving in opposite directions", () => {
  const board: Board = {
    destination: { x: 3, y: 3 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  assertEquals(
    reversals(board, [
      [{ x: 0, y: 0 }, { x: 7, y: 0 }],
      [{ x: 7, y: 0 }, { x: 0, y: 0 }],
    ]),
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
    crossTrailOverlap(board, [
      [{ x: 3, y: 0 }, { x: 3, y: 7 }],
      [{ x: 0, y: 3 }, { x: 7, y: 3 }],
    ]),
    1,
  );
});

Deno.test("searchProfile() is the last-third share of explored states", () => {
  const result: SolverResult = {
    minMoves: 0,
    statesPerDepth: [1, 2, 1],
    goalsPerDepth: [],
    searchedDepth: 0,
    dag: emptyDag,
    nearDag: emptyDag,
  };
  assertEquals(searchProfile(result), 1 / 4);
});

Deno.test("firstMovePrecision() is the reciprocal of distinct optimal openings", () => {
  // ingrid has 6 distinct optimal first moves.
  assertEquals(firstMovePrecision(solveExhaustiveSync(ingridBoard)), 1 / 6);
});

Deno.test("stopWeighted() scores a slide into the edge as weight 1", () => {
  const board: Board = {
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  // One edge stop: piece×3 + wall×2 + edge = 1.
  assertEquals(stopWeighted(board, [[{ x: 0, y: 0 }, { x: 7, y: 0 }]]), 1);
});

Deno.test("pieceUsage() is zero when no blocker is used", () => {
  const board: Board = {
    destination: { x: 7, y: 0 },
    pieces: [{ x: 0, y: 0, type: "puck" }],
    walls: [],
  };

  assertEquals(pieceUsage(board, [[{ x: 0, y: 0 }, { x: 7, y: 0 }]]), 0);
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
    pointlessClearance(board, [
      [{ x: 3, y: 3 }, { x: 3, y: 7 }],
      [{ x: 0, y: 0 }, { x: 7, y: 0 }],
    ]),
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
    sameDirectionRepeat(board, [
      [{ x: 0, y: 0 }, { x: 7, y: 0 }],
      [{ x: 7, y: 0 }, { x: 0, y: 0 }],
      [{ x: 0, y: 0 }, { x: 7, y: 0 }],
    ]),
    8,
  );
});

Deno.test("computeMetrics() reports the full metric set for the ingrid puzzle", () => {
  const metrics = computeMetrics(ingridBoard, solveExhaustiveSync(ingridBoard));

  assertEquals(metrics, {
    setupRatio: 0.42857142857142855,
    coverage: 0.265625,
    deception: 6,
    reversals: 1,
    crossTrailOverlap: 9,
    totalDistance: 26,
    pieceUsage: 5.169925001442312,
    stopWeighted: 15,
    pointlessClearance: 0,
    sameDirectionRepeat: 0,
    uniqueSolutions: 4,
    wallUtilization: 0.42857142857142855,
    deadSpace: 0.4375,
    clumping: 0.06930693069306931,
    firstMovePrecision: 0.16666666666666666,
    searchProfile: 0.8934068908865179,
    // no overshoot on this solve — the isolation pair reads unmeasured
    isolationGap: 0,
    nearMissCount: 0,
  });
});

Deno.test("clumping() is the share of same-kind pairs within Chebyshev 1", () => {
  const clumped: Board = {
    destination: { x: 7, y: 7 },
    pieces: [
      { x: 0, y: 0, type: "puck" },
      { x: 4, y: 4, type: "blocker" },
      { x: 5, y: 4, type: "blocker" },
      { x: 5, y: 5, type: "blocker" },
    ],
    walls: [
      { x: 2, y: 2, orientation: "horizontal" },
      { x: 2, y: 2, orientation: "vertical" },
    ],
  };

  // All 3 blocker pairs and the 1 wall pair are adjacent: 4 close / 4 total.
  assertEquals(clumping(clumped), 1);
});

Deno.test("clumping() is low when structure is spread out", () => {
  // asymmetricBoard: two walls at (2,2)/(6,4) and two blockers at
  // (1,1)/(1,6) — no pair within Chebyshev distance 1.
  assertEquals(clumping(asymmetricBoard), 0);
});

Deno.test("genuineNearMisses() counts real +1 routes and drops padded optimals", () => {
  // One optimal route of length 2.
  const o1: Move = [{ x: 0, y: 0 }, { x: 0, y: 3 }];
  const o2: Move = [{ x: 0, y: 3 }, { x: 3, y: 3 }];
  const optimal = [[o1, o2]];

  // A padded near-miss: the optimal route plus one idle move — removing that
  // move recovers the optimal multiset, so it must NOT count.
  const idle: Move = [{ x: 5, y: 5 }, { x: 5, y: 7 }];
  // A genuine near-miss: a distinct 3-move route sharing no optimal subset.
  const g1: Move = [{ x: 7, y: 7 }, { x: 7, y: 4 }];
  const g2: Move = [{ x: 7, y: 4 }, { x: 4, y: 4 }];
  const g3: Move = [{ x: 4, y: 4 }, { x: 4, y: 2 }];

  // nearDag: goal 10 walks to the padded route, goal 20 to the genuine one.
  // firstSolutionFrom follows the first edge back to root (0), so each chain is
  // laid out last-move-first.
  const nearDag: SolutionDag = {
    root: 0,
    goals: [10, 20],
    predecessors: new Map<number, { from: number; move: Move }[]>([
      [10, [{ from: 11, move: idle }]],
      [11, [{ from: 12, move: o2 }]],
      [12, [{ from: 0, move: o1 }]],
      [20, [{ from: 21, move: g3 }]],
      [21, [{ from: 22, move: g2 }]],
      [22, [{ from: 0, move: g1 }]],
    ]),
  };
  const base = { statesPerDepth: [], goalsPerDepth: [], dag: emptyDag };

  // 1 genuine + 1 padded (excluded) → count 1, so a real route sits at +1 (gap 1).
  assertEquals(
    genuineNearMisses(
      { ...base, minMoves: 2, searchedDepth: 4, nearDag },
      optimal,
    ),
    { count: 1, gap: 1 },
  );

  // Drop the genuine goal: only the padded route remains → nothing genuine at
  // +1, so the optimal stands alone (gap 2).
  assertEquals(
    genuineNearMisses(
      {
        ...base,
        minMoves: 2,
        searchedDepth: 4,
        nearDag: { ...nearDag, goals: [10] },
      },
      optimal,
    ),
    { count: 0, gap: 2 },
  );

  // No overshoot searched → unmeasured.
  assertEquals(
    genuineNearMisses(
      { ...base, minMoves: 2, searchedDepth: 2, nearDag: emptyDag },
      optimal,
    ),
    { count: 0, gap: 0 },
  );
});

Deno.test("wallUtilization() is the fraction of walls that stop a piece", () => {
  const solutions = deduplicateSolutions(
    enumerateSolutions(solveExhaustiveSync(ingridBoard).dag),
  );
  // ingrid: 6 of its 14 interior walls are ever a stop cause.
  assertEquals(wallUtilization(ingridBoard, solutions), 6 / 14);
});

Deno.test("wallUtilization() is vacuously 1 when the board has no walls", () => {
  assertEquals(wallUtilization({ ...ingridBoard, walls: [] }, []), 1);
});

Deno.test("deadSpace() is the fraction of cells no trail, piece, or goal touches", () => {
  const solutions = deduplicateSolutions(
    enumerateSolutions(solveExhaustiveSync(ingridBoard).dag),
  );
  // ingrid: 36 of 64 cells carry structure or action ⇒ 28/64 dead.
  assertEquals(deadSpace(ingridBoard, solutions), 0.4375);
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

Deno.test("checkGates() fails G2 when minMovesFloor raises the band floor", () => {
  // ingrid is a 7-move medium board; a floor of 8 rejects it without touching
  // the band's upper bound.
  assertEquals(
    checkGates(ingridBoard, {
      difficulty: "medium",
      ...noCorpus,
      minMovesFloor: 8,
    }),
    { passed: false, failedGate: "G2" },
  );
});

Deno.test("checkGates() fails G9 for a blocker walled in on all four sides", () => {
  const trapped: Board = {
    ...ingridBoard,
    pieces: [...ingridBoard.pieces, { x: 3, y: 3, type: "blocker" }],
    walls: [
      ...ingridBoard.walls,
      { x: 3, y: 3, orientation: "horizontal" }, // above
      { x: 3, y: 4, orientation: "horizontal" }, // below
      { x: 3, y: 3, orientation: "vertical" }, // left
      { x: 4, y: 3, orientation: "vertical" }, // right
    ],
  };

  assertEquals(
    checkGates(trapped, { difficulty: "medium", ...noCorpus }),
    { passed: false, failedGate: "G9" },
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

Deno.test("scoreBoard() scores each route and aggregates with the mean", () => {
  const scored = scoreBoard(ingridBoard, solveExhaustiveSync(ingridBoard));
  const routeScores = scored.perSolution.map((s) => s.score);

  assertEquals(
    {
      routes: scored.perSolution.length,
      scoreIsMean: scored.score === scored.mean,
      minIsWorstRoute: scored.min === Math.min(...routeScores),
      allRoutesInRange: routeScores.every((s) => s >= -1 && s <= 1),
    },
    {
      routes: 4,
      scoreIsMean: true,
      minIsWorstRoute: true,
      allRoutesInRange: true,
    },
  );
});
