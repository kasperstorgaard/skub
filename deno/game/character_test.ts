import { assertEquals } from "@std/assert";

import { boardCharacter, type CharacterContext } from "./character.ts";
import type { Metrics } from "#/game/scoring.ts";

/** An unremarkable board: nothing crosses any trait's threshold. */
const plainMetrics: Metrics = {
  setupRatio: 0.3,
  coverage: 0.2,
  deception: 0,
  reversals: 0,
  crossTrailOverlap: 0,
  totalDistance: 10,
  pieceUsage: 2,
  stopWeighted: 10,
  pointlessClearance: 0,
  sameDirectionRepeat: 0,
  openingSetup: 0,
  uniqueSolutions: 3,
  wallUtilization: 0.4,
  deadSpace: 0.6,
  puckPathVariety: 1,
  clumping: 0.1,
  emptyRegion: 0.2,
  wallSymmetry: 0.3,
  firstMovePrecision: 0.5,
  searchProfile: 0.5,
  isolationGap: 1,
  nearMissCount: 0,
};

const plainContext: CharacterContext = {
  minMoves: 8,
  walls: 10,
  blockers: 4,
};

const labelsOf = (metrics: Metrics, context: CharacterContext) =>
  boardCharacter(metrics, context).map((trait) => trait.label);

Deno.test("boardCharacter() says nothing about an unremarkable board", () => {
  assertEquals(labelsOf(plainMetrics, plainContext), []);
});

Deno.test("boardCharacter() calls out solutions that share a puck path", () => {
  assertEquals(
    labelsOf({ ...plainMetrics, uniqueSolutions: 4, puckPathVariety: 0.5 }, {
      ...plainContext,
    }),
    ["false variety"],
  );
});

Deno.test("boardCharacter() reads a single-solution board as one true path", () => {
  assertEquals(
    labelsOf({ ...plainMetrics, uniqueSolutions: 1 }, plainContext),
    ["one true path"],
  );
});

Deno.test("boardCharacter() flags a puck that waits for the setup", () => {
  assertEquals(
    labelsOf({ ...plainMetrics, openingSetup: 2 }, plainContext),
    ["slow start"],
  );
});

Deno.test("boardCharacter() separates working walls from decorative ones", () => {
  const heavy = { ...plainContext, walls: 14 };
  assertEquals(
    labelsOf({ ...plainMetrics, wallUtilization: 0.6 }, heavy),
    ["wall-heavy"],
  );
  assertEquals(
    labelsOf({ ...plainMetrics, wallUtilization: 0.2 }, heavy),
    ["decorative walls"],
  );
});

Deno.test("boardCharacter() shows at most three traits", () => {
  const loud: Metrics = {
    ...plainMetrics,
    uniqueSolutions: 1,
    openingSetup: 3,
    setupRatio: 0.8,
    reversals: 3,
    deception: 6,
    clumping: 0.3,
    pointlessClearance: 2,
  };

  assertEquals(boardCharacter(loud, plainContext).length, 3);
});
