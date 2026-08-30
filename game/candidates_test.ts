import { assertEquals } from "@std/assert/equals";

import {
  type Candidate,
  candidateSource,
  formatCandidate,
  parseCandidate,
  type ReasonTag,
  storedSolutionMoves,
  toStoredScoring,
} from "./candidates.ts";
import { CALIBRATION, type Metrics, type ScoredBoard } from "#/game/scoring.ts";
import type { Move } from "#/game/types.ts";

const baseCandidate = (): Candidate => ({
  number: 0,
  name: "Untitled",
  slug: "gen-123",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  difficulty: "medium",
  minMoves: 8,
  board: {
    destination: { x: 3, y: 3 },
    pieces: [
      { x: 1, y: 1, type: "puck" },
      { x: 5, y: 5, type: "blocker" },
    ],
    walls: [{ x: 2, y: 2, orientation: "vertical" }],
  },
  genOptions: {
    difficulty: "medium",
    wallsRange: [5, 15],
    blockersRange: [3, 5],
    wallSpread: "balanced",
    symmetry: 0.5,
  },
  generatorVersion: "0.5",
});

Deno.test("formatCandidate → parseCandidate round-trips feedback + provenance", () => {
  const candidate: Candidate = {
    ...baseCandidate(),
    rating: 2,
    reasons: ["clumped", "empty-areas"] as ReasonTag[],
    note: "huddles in one corner",
  };

  const parsed = parseCandidate(formatCandidate(candidate));

  assertEquals(parsed.rating, 2);
  assertEquals(parsed.reasons, ["clumped", "empty-areas"]);
  assertEquals(parsed.note, "huddles in one corner");
  assertEquals(parsed.genOptions, candidate.genOptions);
  assertEquals(parsed.generatorVersion, "0.5");
  assertEquals(parsed.board, candidate.board);
});

Deno.test("an unrated candidate omits rating cleanly", () => {
  const parsed = parseCandidate(formatCandidate(baseCandidate()));

  assertEquals(parsed.rating, undefined);
  // Provenance still round-trips even without any feedback.
  assertEquals(parsed.generatorVersion, "0.5");
  assertEquals(parsed.genOptions?.symmetry, 0.5);
});

/** Every metric at a distinguishable value, so a dropped key shows up. */
const metricsAt = (base: number): Metrics => ({
  setupRatio: base,
  coverage: base + 0.01,
  deception: base + 0.02,
  reversals: 1,
  crossTrailOverlap: 2,
  totalDistance: 20,
  pieceUsage: base + 0.03,
  stopWeighted: 12,
  pointlessClearance: 0,
  sameDirectionRepeat: 0,
  openingSetup: 1,
  uniqueSolutions: 2,
  wallUtilization: base + 0.04,
  deadSpace: base + 0.05,
  puckPathVariety: 0.5,
  clumping: base + 0.06,
  emptyRegion: base + 0.07,
  wallSymmetry: base + 0.08,
  firstMovePrecision: 0.25,
  searchProfile: base + 0.09,
  isolationGap: 2,
  nearMissCount: 1,
});

const routeA: Move[] = [[{ x: 1, y: 1 }, { x: 1, y: 5 }], [{ x: 1, y: 5 }, {
  x: 4,
  y: 5,
}]];
const routeB: Move[] = [[{ x: 5, y: 5 }, { x: 5, y: 0 }]];

const scoredBoard = (): ScoredBoard => ({
  score: 0.4123456,
  mean: 0.4123456,
  min: 0.3,
  stddev: 0.05,
  perSolution: [
    { moves: routeA, metrics: metricsAt(0.3), score: 0.3 },
    { moves: routeB, metrics: metricsAt(0.5), score: 0.5246913 },
  ],
});

Deno.test("a candidate's scoring survives the trip through markdown", () => {
  const candidate: Candidate = {
    ...baseCandidate(),
    scoring: toStoredScoring(scoredBoard(), metricsAt(0.4)),
  };

  const parsed = parseCandidate(formatCandidate(candidate));

  // Rounded for a readable diff, not truncated to uselessness.
  assertEquals(parsed.scoring?.score, 0.4123);
  assertEquals(parsed.scoring?.min, 0.3);
  assertEquals(parsed.scoring?.metrics, candidate.scoring?.metrics);
  assertEquals(parsed.scoring?.calibrationVersion, CALIBRATION.version);
  assertEquals(parsed.scoring?.solutions.length, 2);
  assertEquals(parsed.scoring?.solutions[1].score, 0.5247);
  assertEquals(
    parsed.scoring?.solutions[0].metrics,
    candidate.scoring?.solutions[0].metrics,
  );
  // The stored move encoding is the URL's, and decodes back to the routes.
  assertEquals(storedSolutionMoves(parsed.scoring!), [routeA, routeB]);
});

Deno.test("per-route tags round-trip keyed by their moves", () => {
  const scoring = toStoredScoring(scoredBoard(), metricsAt(0.4));
  const candidate: Candidate = {
    ...baseCandidate(),
    rating: 4,
    scoring,
    solutionTags: {
      [scoring.solutions[0].moves]: ["interesting", "unique"],
      [scoring.solutions[1].moves]: ["too-easy", "boring"],
    },
  };

  const parsed = parseCandidate(formatCandidate(candidate));

  assertEquals(parsed.solutionTags, candidate.solutionTags);
  // The puzzle-level rating is untouched by a route being labelled.
  assertEquals(parsed.rating, 4);
});

Deno.test("a candidate's source round-trips through markdown", () => {
  const candidate = { ...baseCandidate(), source: "corpus" as const };
  const parsed = parseCandidate(formatCandidate(candidate));

  assertEquals(candidateSource(parsed), "corpus");
});

Deno.test("an entry written before source existed reads as generated", () => {
  // The store predates the field; the whole of it is generator output, so the
  // absent value has one honest reading.
  const { source: _source, ...withoutSource } = {
    ...baseCandidate(),
    source: undefined,
  };

  assertEquals(candidateSource(withoutSource), "generated");
});
