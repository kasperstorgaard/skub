import { assertEquals } from "@std/assert";

import {
  aggregateMetrics,
  meanMetrics,
  METRIC_CATALOG,
} from "./metric-catalog.ts";
import type { Metrics } from "#/game/scoring.ts";

/**
 * Two routes of the same board: the route-scope metrics differ between them,
 * the board-scope ones can't (they're properties of the board, and every route
 * is measured against the same one).
 */
const routes: Metrics[] = [
  {
    // route scope
    setupRatio: 0.2,
    coverage: 0.1,
    deception: 2,
    reversals: 0,
    crossTrailOverlap: 4,
    totalDistance: 20,
    pieceUsage: 3,
    stopWeighted: 10,
    pointlessClearance: 0,
    sameDirectionRepeat: 2,
    openingSetup: 0,
    // board scope
    uniqueSolutions: 2,
    wallUtilization: 0.5,
    deadSpace: 0.6,
    puckPathVariety: 1,
    clumping: 0.1,
    emptyRegion: 0.3,
    wallSymmetry: 0.25,
    firstMovePrecision: 0.5,
    searchProfile: 0.8,
    isolationGap: 2,
    nearMissCount: 1,
  },
  {
    setupRatio: 0.6,
    coverage: 0.3,
    deception: 6,
    reversals: 2,
    crossTrailOverlap: 8,
    totalDistance: 30,
    pieceUsage: 5,
    stopWeighted: 14,
    pointlessClearance: 2,
    sameDirectionRepeat: 4,
    openingSetup: 2,
    uniqueSolutions: 2,
    wallUtilization: 0.5,
    deadSpace: 0.6,
    puckPathVariety: 1,
    clumping: 0.1,
    emptyRegion: 0.3,
    wallSymmetry: 0.25,
    firstMovePrecision: 0.5,
    searchProfile: 0.8,
    isolationGap: 2,
    nearMissCount: 1,
  },
];

Deno.test("meanMetrics() averages the route-scope metrics", () => {
  const mean = meanMetrics(routes);

  assertEquals(mean.setupRatio, 0.4);
  assertEquals(mean.totalDistance, 25);
  // Penalties average like everything else — the mean is a summary, not the
  // worst-case reduction the composite asks for.
  assertEquals(mean.pointlessClearance, 1);
});

Deno.test("meanMetrics() leaves board-scope metrics at their value", () => {
  const mean = meanMetrics(routes);

  for (const spec of METRIC_CATALOG) {
    if (spec.scope !== "board") continue;
    assertEquals(
      mean[spec.key],
      routes[0][spec.key],
      `${spec.key} should be route-constant`,
    );
  }
});

Deno.test("meanMetrics() differs from the composite's reduction", () => {
  const mean = meanMetrics(routes);
  const aggregate = aggregateMetrics(routes);

  // `max` for a signal, `min` for a penalty — what the best or worst route
  // offers, which is a different question from what a typical route looks like.
  assertEquals(aggregate.setupRatio, 0.6);
  assertEquals(aggregate.pointlessClearance, 0);
  assertEquals(mean.setupRatio, 0.4);
});

Deno.test("meanMetrics() is zero-filled for a board with no routes", () => {
  assertEquals(meanMetrics([]).setupRatio, 0);
});
