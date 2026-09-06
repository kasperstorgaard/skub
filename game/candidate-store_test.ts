import { assertEquals } from "@std/assert/equals";

import {
  analyseBoard,
  mergeCandidate,
  staleAnalysis,
  stripVariant,
} from "./candidate-store.ts";
import type { Candidate, StoredScoring } from "#/game/candidates.ts";
import { CALIBRATION, type Metrics } from "#/game/scoring.ts";
import type { Board, Puzzle } from "#/game/types.ts";

const board: Board = {
  holes: [],
  portals: [],
  destination: { x: 3, y: 3 },
  pieces: [
    { x: 1, y: 1, type: "puck" },
    { x: 5, y: 5, type: "blocker" },
  ],
  walls: [
    { x: 2, y: 2, orientation: "vertical" },
    { x: 4, y: 6, orientation: "horizontal" },
  ],
};

Deno.test("stripVariant() takes a version back to the board it forked from", () => {
  assertEquals(stripVariant("erik-b"), "erik");
});

Deno.test("stripVariant() takes a later version back to the same board", () => {
  assertEquals(stripVariant("erik-c"), "erik");
});

Deno.test("stripVariant() leaves a board that was never forked alone", () => {
  assertEquals(stripVariant("erik"), "erik");
});

Deno.test("stripVariant() leaves a numeric name-collision suffix alone", () => {
  // `hans-2` is a different board whose name collided, not a second version of
  // `hans` — promoting it must not ship it as `hans`.
  assertEquals(stripVariant("hans-2"), "hans-2");
});

Deno.test("stripVariant() forks a name-collision board back to its own name", () => {
  assertEquals(stripVariant("hans-2-b"), "hans-2");
});

Deno.test("stripVariant() strips the name as it strips the slug", () => {
  assertEquals(stripVariant("Erik-b"), "Erik");
});

/** Solves in one move: the puck slides down and the blocker stops it on target. */
const oneMoveBoard: Board = {
  holes: [],
  portals: [],
  destination: { x: 0, y: 3 },
  pieces: [
    { x: 0, y: 0, type: "puck" },
    { x: 0, y: 4, type: "blocker" },
  ],
  walls: [],
};

Deno.test("analyseBoard() reports the board's optimal move count", () => {
  assertEquals(analyseBoard(oneMoveBoard).minMoves, 1);
});

Deno.test("analyseBoard() stores every distinct optimal route in move notation", () => {
  const { scoring } = analyseBoard(oneMoveBoard);

  assertEquals(scoring.solutions.map((solution) => solution.moves), ["A1A4"]);
});

Deno.test("analyseBoard() stamps the calibration the scores were measured under", () => {
  assertEquals(
    analyseBoard(oneMoveBoard).scoring.calibrationVersion,
    CALIBRATION.version,
  );
});

const metrics: Metrics = {
  setupRatio: 0.25,
  coverage: 0.3,
  deception: 4,
  reversals: 1,
  crossTrailOverlap: 2,
  totalDistance: 20,
  pieceUsage: 0.5,
  stopWeighted: 12,
  pointlessClearance: 0,
  sameDirectionRepeat: 0,
  openingSetup: 1,
  uniqueSolutions: 2,
  wallUtilization: 0.6,
  deadSpace: 0.4,
  puckPathVariety: 0.5,
  clumping: 0.2,
  emptyRegion: 0.3,
  wallSymmetry: 0.8,
  firstMovePrecision: 0.25,
  searchProfile: 0.4,
  isolationGap: 2,
  nearMissCount: 1,
};

const scoring: StoredScoring = {
  score: 0.42,
  mean: 0.42,
  min: 0.3,
  stddev: 0.05,
  metrics,
  solutions: [{ moves: "b2b6f6", score: 0.42, metrics }],
  calibrationVersion: CALIBRATION.version,
};

/** A rated entry on disk: the board plus everything the curator put on it. */
const rated: Candidate = {
  name: "Erik",
  slug: "erik",
  board,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  difficulty: "hard",
  minMoves: 7,
  source: "generated",
  rating: 4,
  reasons: ["pretty"],
  note: "worth keeping",
  solutionTags: { "b2b6f6": ["interesting"] },
  genOptions: {
    wallsRange: [5, 15],
    blockersRange: [3, 5],
    wallSpread: "balanced",
    symmetry: 0.5,
  },
  generatorVersion: "0.7.0",
  promotedAs: "erik",
};

/** What `clone` hands the editor: the same board, identity stripped. */
const redrawn: Puzzle = {
  number: 0,
  name: "Erik",
  slug: "erik",
  board,
  createdAt: new Date("2026-08-30T00:00:00.000Z"),
  difficulty: "easy",
  minMoves: 0,
};

Deno.test("mergeCandidate() keeps everything the stored entry owns", () => {
  assertEquals(mergeCandidate(redrawn, { ...rated, scoring }), {
    // The placeholder number goes; numbers are the corpus schedule.
    number: undefined,
    name: "Erik",
    slug: "erik",
    board,
    // The date, the measured count and the label survive a draft that reset them.
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    difficulty: "hard",
    minMoves: 7,
    source: "generated",
    rating: 4,
    reasons: ["pretty"],
    note: "worth keeping",
    solutionTags: { "b2b6f6": ["interesting"] },
    genOptions: {
      wallsRange: [5, 15],
      blockersRange: [3, 5],
      wallSpread: "balanced",
      symmetry: 0.5,
    },
    generatorVersion: "0.7.0",
    promotedAs: "erik",
    scoring,
  });
});

Deno.test("mergeCandidate() takes a new entry's difficulty from the move count", () => {
  // A one-move board is easy whatever the draft claimed.
  const merged = mergeCandidate({ ...redrawn, difficulty: "ultra" }, null, {
    analysis: { minMoves: 1, scoring },
  });

  assertEquals(merged.difficulty, "easy");
});

Deno.test("mergeCandidate() leaves a difficulty already on disk alone", () => {
  const merged = mergeCandidate(redrawn, rated, {
    analysis: { minMoves: 1, scoring },
  });

  assertEquals(merged.difficulty, "hard");
});

Deno.test("mergeCandidate() takes the move count from a fresh analysis", () => {
  const merged = mergeCandidate(redrawn, rated, {
    analysis: { minMoves: 9, scoring },
  });

  assertEquals(merged.minMoves, 9);
});

Deno.test("mergeCandidate() takes the scoring from a fresh analysis", () => {
  const measured: StoredScoring = { ...scoring, score: 0.9 };
  const merged = mergeCandidate(redrawn, { ...rated, scoring }, {
    analysis: { minMoves: 9, scoring: measured },
  });

  assertEquals(merged.scoring, measured);
});

Deno.test("mergeCandidate() keeps the stored analysis when none was measured", () => {
  assertEquals(mergeCandidate(redrawn, { ...rated, scoring }).scoring, scoring);
});

Deno.test("mergeCandidate() keeps the stored source when none is given", () => {
  const merged = mergeCandidate(redrawn, { ...rated, source: "corpus" });

  assertEquals(merged.source, "corpus");
});

Deno.test("mergeCandidate() takes the given source over the stored one", () => {
  const merged = mergeCandidate(redrawn, rated, { source: "corpus" });

  assertEquals(merged.source, "corpus");
});

Deno.test("mergeCandidate() reads an entry with no stored source as generated", () => {
  assertEquals(mergeCandidate(redrawn, null).source, "generated");
});

Deno.test("mergeCandidate() drops the editor's placeholder puzzle number", () => {
  assertEquals(mergeCandidate(redrawn, null).number, undefined);
});

Deno.test("staleAnalysis() is false when the stored scoring describes the board", () => {
  assertEquals(staleAnalysis({ ...rated, scoring }, board), false);
});

Deno.test("staleAnalysis() is true when the board moved under the scoring", () => {
  const moved: Board = {
    holes: [],
    portals: [],
    destination: { x: 3, y: 3 },
    pieces: [
      { x: 1, y: 1, type: "puck" },
      { x: 5, y: 6, type: "blocker" },
    ],
    walls: [
      { x: 2, y: 2, orientation: "vertical" },
      { x: 4, y: 6, orientation: "horizontal" },
    ],
  };

  assertEquals(staleAnalysis({ ...rated, scoring }, moved), true);
});

Deno.test("staleAnalysis() is true across a calibration bump", () => {
  const outdated: StoredScoring = { ...scoring, calibrationVersion: "4.0.0" };

  assertEquals(staleAnalysis({ ...rated, scoring: outdated }, board), true);
});

Deno.test("staleAnalysis() is true when the entry was never analysed", () => {
  assertEquals(staleAnalysis(rated, board), true);
});

Deno.test("staleAnalysis() is true when nothing is stored", () => {
  assertEquals(staleAnalysis(null, board), true);
});
